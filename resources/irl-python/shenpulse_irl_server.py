"""Serveur d'exécution IRL embarqué par ShenPulse.

Adapté du projet SERVEUR_IRL fourni par le propriétaire. Les anciens cadeaux,
listeners externes et adresses Shelly codés en dur ont volontairement
été retirés : le moteur de règles ShenPulse envoie ici des commandes JSON
dynamiques sur stdin et reçoit une réponse JSON sur stdout.
"""

import argparse
import ipaddress
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


PROTOCOL_VERSION = 1
DEFAULT_TIMEOUT_SECONDS = 5.0
MAX_DURATION_MS = 60_000
HOSTNAME_PATTERN = re.compile(r"^[a-zA-Z0-9.-]{1,253}$")


class CommandError(Exception):
    """Erreur de commande destinée à être renvoyée à ShenPulse."""


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    sys.stdout.write("\n")
    sys.stdout.flush()


def clean_host(value):
    host = str(value or "").strip().lower()
    if not host or not HOSTNAME_PATTERN.fullmatch(host):
        raise CommandError("Adresse Shelly locale invalide.")
    if host == "localhost" or host.endswith(".local"):
        return host
    try:
        address = ipaddress.ip_address(host)
    except ValueError as error:
        raise CommandError("Seules les adresses IP privées et les noms .local sont permis.") from error
    if not (address.is_private or address.is_loopback or address.is_link_local):
        raise CommandError("La prise doit être accessible sur le réseau local.")
    return host


def bounded_int(value, minimum, maximum, fallback):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, number))


def request_json(url, method="GET", payload=None, timeout=DEFAULT_TIMEOUT_SECONDS):
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(512_000).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        detail = error.read(500).decode("utf-8", errors="replace")
        raise CommandError(f"Shelly HTTP {error.code}: {detail}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise CommandError(f"Prise Shelly inaccessible: {error}") from error
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise CommandError("La prise Shelly a renvoyé une réponse JSON invalide.") from error


def identify_shelly(params):
    host = clean_host(params.get("host"))
    return request_json(f"http://{host}/shelly", timeout=2.0)


def provision_shelly(params):
    host = clean_host(params.get("host") or "192.168.33.1")
    generation = bounded_int(params.get("generation"), 1, 9, 1)
    ssid = str(params.get("ssid") or "").strip()
    password = str(params.get("password") or "")
    if not ssid or len(ssid) > 32:
        raise CommandError("Le nom du réseau Wi-Fi est invalide.")
    try:
        if generation >= 2:
            return request_json(
                f"http://{host}/rpc/WiFi.SetConfig",
                method="POST",
                payload={
                    "config": {
                        "sta": {"ssid": ssid, "pass": password, "enable": True}
                    }
                },
                timeout=7.0,
            )
        query = urllib.parse.urlencode(
            {"enabled": "1", "ssid": ssid, "key": password}
        )
        return request_json(f"http://{host}/settings/sta?{query}", timeout=7.0)
    except CommandError as error:
        # Une prise peut couper son point d'accès immédiatement après avoir
        # enregistré le Wi-Fi, avant d'avoir terminé la réponse HTTP.
        message = str(error).lower()
        if "inaccessible" in message or "timed out" in message:
            return {"accepted": True, "reconnecting": True}
        raise


def control_shelly(params):
    device = params.get("device") or {}
    host = clean_host(device.get("host"))
    generation = bounded_int(device.get("generation"), 1, 9, 1)
    channel = bounded_int(device.get("channel"), 0, 16, 0)
    operation = str(params.get("operation") or "toggle").strip().lower()
    if operation not in ("on", "off", "toggle", "cycle", "pulse"):
        raise CommandError("Commande Shelly invalide.")
    duration_ms = bounded_int(
        params.get("durationMs"), 500, MAX_DURATION_MS, 3000
    )

    if generation >= 2:
        method = "Switch.Toggle" if operation == "toggle" else "Switch.Set"
        payload = {"id": channel}
        if operation != "toggle":
            payload["on"] = operation in ("on", "pulse")
        if operation in ("cycle", "pulse"):
            payload["toggle_after"] = duration_ms / 1000
        result = request_json(
            f"http://{host}/rpc/{method}",
            method="POST",
            payload=payload,
        )
    else:
        if operation == "cycle":
            turn = "off"
        elif operation == "pulse":
            turn = "on"
        else:
            turn = operation
        query = {"turn": turn}
        if operation in ("cycle", "pulse"):
            query["timer"] = duration_ms / 1000
        result = request_json(
            f"http://{host}/relay/{channel}?{urllib.parse.urlencode(query)}"
        )

    return {
        "ok": True,
        "host": host,
        "generation": generation,
        "channel": channel,
        "operation": operation,
        "result": result,
    }


def handle_command(message):
    command = str(message.get("command") or "").strip()
    params = message.get("params") or {}
    if command == "health":
        return {
            "protocol": PROTOCOL_VERSION,
            "capabilities": [
                "shelly.identify",
                "shelly.provision",
                "shelly.control",
            ],
            "giftRules": 0,
        }
    if command == "shelly.identify":
        return identify_shelly(params)
    if command == "shelly.provision":
        return provision_shelly(params)
    if command == "shelly.control":
        return control_shelly(params)
    if command == "shutdown":
        return {"stopping": True}
    raise CommandError(f"Commande IRL inconnue: {command or '(vide)'}")


def serve():
    emit(
        {
            "type": "ready",
            "protocol": PROTOCOL_VERSION,
            "capabilities": [
                "shelly.identify",
                "shelly.provision",
                "shelly.control",
            ],
            "giftRules": 0,
        }
    )
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        request_id = ""
        command = ""
        try:
            message = json.loads(line)
            request_id = str(message.get("id") or "")
            command = str(message.get("command") or "")
            result = handle_command(message)
            emit({"id": request_id, "ok": True, "result": result})
            if command == "shutdown":
                return 0
        except (CommandError, json.JSONDecodeError, TypeError, ValueError) as error:
            emit({"id": request_id, "ok": False, "error": str(error)})
        except Exception as error:  # pragma: no cover - garde-fou du sidecar
            emit(
                {
                    "id": request_id,
                    "ok": False,
                    "error": f"Erreur Python IRL inattendue: {error}",
                }
            )
    return 0


def self_test():
    result = handle_command({"command": "health", "params": {}})
    if result.get("giftRules") != 0:
        raise RuntimeError("Des cadeaux codés en dur sont encore présents.")
    emit({"ok": True, "result": result})
    return 0


def main():
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    return self_test() if args.self_test else serve()


if __name__ == "__main__":
    raise SystemExit(main())
