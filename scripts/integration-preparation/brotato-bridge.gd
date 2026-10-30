extends Node

# A local client. Effect deadlines use real time, including during game slowdowns.
const PORT := 58815
const MOD_DIR := "ShenPulse-Bridge/"
var client := StreamPeerTCP.new()
var retry_at := 0
var incoming := PoolByteArray()
var completed := {}
var timers := {}
var game: Node
var overlay: CanvasLayer
var mod_dir_path := ""

func _init() -> void:
	mod_dir_path = ModLoaderMod.get_unpacked_dir().plus_file(MOD_DIR)
	ModLoaderMod.install_script_extension(mod_dir_path.plus_file("extensions/main.gd"))

func _ready() -> void:
	game = load(mod_dir_path.plus_file("shenpulse_game.gd")).new()
	add_child(game)
	overlay = load(mod_dir_path.plus_file("overlay.gd")).new()
	add_child(overlay)
	game.connect("message_shown", overlay, "show_line")
	game.connect("user_message_shown", overlay, "show_user_line")
	pause_mode = Node.PAUSE_MODE_PROCESS
	overlay.show_line("Module ShenPulse prêt")

func _process(_delta: float) -> void:
	if client.has_method("poll"):
		client.call("poll")
	var now := OS.get_ticks_msec()
	for key in timers.keys():
		if now >= int(timers[key].until):
			_restore(key)
	var state := client.get_status()
	if state == StreamPeerTCP.STATUS_NONE or state == StreamPeerTCP.STATUS_ERROR:
		if now >= retry_at:
			client.disconnect_from_host()
			incoming = PoolByteArray()
			completed.clear()
			retry_at = now + 3000
			client.connect_to_host("127.0.0.1", PORT)
		return
	if state != StreamPeerTCP.STATUS_CONNECTED:
		return
	var available := client.get_available_bytes()
	if available <= 0:
		return
	var received := client.get_data(min(available, 65536))
	if received[0] != OK:
		client.disconnect_from_host()
		return
	for byte in received[1]:
		if byte == 0:
			var parsed := JSON.parse(incoming.get_string_from_utf8())
			incoming = PoolByteArray()
			if parsed.error == OK and typeof(parsed.result) == TYPE_DICTIONARY:
				_receive(parsed.result)
		else:
			incoming.append(byte)
			if incoming.size() > 65536:
				incoming = PoolByteArray()
				client.disconnect_from_host()
				return

func _send(response: Dictionary) -> void:
	var bytes := JSON.print(response).to_utf8()
	bytes.append(0)
	client.put_data(bytes)

func _receive(request: Dictionary) -> void:
	var id := int(request.get("id", -1))
	if id < 0:
		return
	if request.get("code", "") == "shenpulse_status":
		_send({"id": id, "status": 0, "message": JSON.print(_state())})
		return
	if completed.has(id):
		_send(completed[id])
		return
	var response := {"id": id, "status": 3, "message": "Chargez une vague avec un joueur vivant, hors pause."}
	if game.is_in_run() and not get_tree().paused:
		var applied = _execute(request)
		response.status = 0 if applied else 1
		response.message = "Interaction appliquée" if applied else "Effet impossible dans la situation actuelle"
		if applied:
			game.show_user_message(str(request.get("viewer", "ShenPulse")), str(request.get("code", "")))
			completed[id] = response
			if completed.size() > 128:
				completed.erase(completed.keys()[0])
	_send(response)

func _number(params: Dictionary, key: String, fallback: int, maximum: int = 10000) -> int:
	return int(clamp(int(params.get(key, fallback)), 1, maximum))

func _execute(request: Dictionary):
	var code := str(request.get("code", ""))
	var p: Dictionary = request.get("parameters", {})
	var seconds := clamp(float(request.get("duration", 10000)) / 1000.0, 1.0, 600.0)
	match code:
		"add_gold": return game.add_gold(_number(p, "amount", 25))
		"steal_gold": return game.remove_gold(_number(p, "amount", 25)) > 0
		"heal_player": return game.heal_player(_number(p, "amount", 20)) > 0
		"hit_player": return game.damage_player(_number(p, "amount", 10)) > 0
		"kill_player": return game.kill_player()
		"level_up": return game.level_up(_number(p, "levels", 1, 20)) > 0
		"reset_level": return game.reset_level()
		"nuke": return game.kill_enemies(10000) > 0
		"fruit_rain": return game.spawn_consumables("fruit", _number(p, "count", 5, 100)) > 0
		"loot_crate": return game.spawn_consumables("legendary_crate" if p.get("Crate", "normal") == "legendary" else "crate", 1) > 0
		"add_wave_time": return game.add_wave_time(_number(p, "seconds", 10, 300))
		"remove_wave_time": return game.add_wave_time(-_number(p, "seconds", 10, 300))
		"end_wave": return game.end_wave()
		"restart_wave": return game.restart_wave()
		"spawn_enemies": return game.spawn_enemies(_number(p, "count", 5, 100)) > 0
		"spawn_enemy": return game.spawn_named_enemies(_enemy_id(p), 1, false) > 0
		"ambush": return game.spawn_named_enemies(_enemy_id(p), 8, true) > 0
		"spawn_elite": return not game.spawn_elite().empty()
		"friendly_explosion": return game.explode_at_player(_number(p, "damage", 100), 2.0)
		"player_explosion":
			game.explode_at_player(100, 1.5)
			return game.damage_player(_number(p, "damage", 10)) > 0
		"upgrade_weapon": return game.change_weapon_tier(1, _number(p, "count", 1, 6)) > 0
		"downgrade_weapon": return game.change_weapon_tier(-1, _number(p, "count", 1, 6)) > 0
		"remove_weapon": return game.remove_weapons(99 if p.get("Weapons", "one") == "all" else 1) > 0
		"invincible": return _timed("invincible", "set_invincible", [seconds], "end_invincible", [], seconds)
		"magnet": return _timed("magnet", "set_magnet", [true], "set_magnet", [false], seconds)
		"bounty":
			timers.bounty = {"until": OS.get_ticks_msec() + int(seconds * 1000), "method": "", "args": []}
			return true
		"speed_boost": return _stat("speed_boost", "stat_speed", 30, seconds)
		"damage_boost": return _stat("damage_boost", "stat_percent_damage", 30, seconds)
		"attack_speed_boost": return _stat("attack_speed_boost", "stat_attack_speed", 30, seconds)
		"armor_boost": return _stat("armor_boost", "stat_armor", 10, seconds)
		"slow_player": return _stat("slow_player", "stat_speed", -30, seconds)
		"weaken": return _stat("weaken", "stat_percent_damage", -30, seconds)
		"slow_attacks": return _stat("slow_attacks", "stat_attack_speed", -30, seconds)
		"fragile": return _stat("fragile", "stat_armor", -10, seconds)
		"flip_screen": return _timed("flip_screen", "set_screen_flipped", [true], "set_screen_flipped", [false], seconds)
		"blackout": return _timed("blackout", "set_blackout", [true], "set_blackout", [false], seconds)
		"big_player", "tiny_player": return _timed("player_scale", "set_player_scale", [2.0 if code == "big_player" else 0.5], "set_player_scale", [1.0], seconds)
		"game_slow", "game_fast", "game_ultra_fast": return _timed("game_speed", "set_game_speed", [0.5 if code == "game_slow" else 2.0 if code == "game_fast" else 3.0], "set_game_speed", [1.0], seconds)
		"buff_enemies": return _timed("buff_enemies", "boost_enemies", [50], "unboost_enemies", [], seconds)
		"big_enemies", "small_enemies": return _timed("enemy_scale", "set_enemies_scale", [2.0 if code == "big_enemies" else 0.5], "reset_enemies_scale", [], seconds)
	return false

func _stat(key: String, name: String, amount: int, seconds: float) -> bool:
	return _timed(key, "add_temp_stat", [name, amount], "remove_temp_stat", [name, amount], seconds)

func _timed(key: String, apply: String, args: Array, restore: String, restore_args: Array, seconds: float) -> bool:
	_restore(key)
	var result = game.callv(apply, args)
	if not result:
		return false
	timers[key] = {"until": OS.get_ticks_msec() + int(seconds * 1000), "method": restore, "args": restore_args}
	return true

func _restore(key: String) -> void:
	if not timers.has(key):
		return
	var previous: Dictionary = timers[key]
	timers.erase(key)
	if previous.method != "" and is_instance_valid(game):
		game.callv(previous.method, previous.args)

func notify_game_event(event: String, data: Dictionary = {}) -> void:
	if event == "enemy_died" and timers.has("bounty") and int(data.get("killed_by_player", 0)) == 1:
		game.add_gold(1)
	if event == "wave_ended" or event == "player_died" or event == "game_leaving":
		for key in timers.keys():
			_restore(key)

func _exit_tree() -> void:
	for key in timers.keys():
		_restore(key)
	Engine.time_scale = 1.0
	client.disconnect_from_host()

func _enemy_id(parameters: Dictionary) -> String:
 var selected := str(parameters.get("Enemy", "random"))
 if selected != "random":
  return selected
 var choices := []
 for candidate in ["bruiser", "charger", "chaser", "spitter"]:
  if ResourceLoader.exists("res://entities/units/enemies/%s/%s.tscn" % [candidate, candidate]):
   choices.append(candidate)
 return "" if choices.empty() else choices[randi() % choices.size()]

func _state() -> Dictionary:
 var state := {"inRun": game.is_in_run(), "paused": get_tree().paused, "wave": RunData.current_wave, "timeScale": Engine.time_scale, "activeEffects": timers.keys()}
 var player = game._player_node(0)
 var main = game._main()
 if player != null:
  state.health = player.current_stats.health
  state.maxHealth = player.max_stats.health
  state.gold = RunData.get_player_gold(0)
  state.level = RunData.get_player_level(0)
  state.playerScale = [player.scale.x, player.scale.y]
  state.weaponCount = player.current_weapons.size()
  state.invincibleTime = player._invincibility_timer.time_left
  state.stats = {}
  for stat in ["stat_speed", "stat_armor", "stat_percent_damage", "stat_attack_speed"]:
   state.stats[stat] = Utils.get_stat(Keys.generate_hash(stat), 0)
 if main != null:
  state.waveTime = main._wave_timer.time_left
 var spawner = game._spawner()
 if spawner != null:
  var alive := 0
  var boosted := 0
  for enemy in spawner.enemies:
   if is_instance_valid(enemy) and not enemy.dead:
    alive += 1
    if enemy.is_boosted:
     boosted += 1
  state.enemyCount = alive
  state.boostedEnemies = boosted
 return state
