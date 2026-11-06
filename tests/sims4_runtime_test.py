"""Transport regression tests: no Sims installation or personal save is needed."""
import ast
import pathlib
import unittest
from unittest.mock import Mock
import json

SOURCE = pathlib.Path(__file__).resolve().parents[1] / 'scripts/game-mods/the-sims-4/Runtime.py'

class Socket:
    def __init__(self, chunks):
        self.chunks = list(chunks)
        self.closed = False
    def recv(self, size):
        return self.chunks.pop(0)
    def close(self):
        self.closed = True

class TransportTests(unittest.TestCase):
    def context(self, chunks):
        module = ast.parse(SOURCE.read_text(encoding='utf8'))
        nodes = [node for node in module.body if isinstance(node, ast.FunctionDef) and node.name in ('_disconnect', 'inject_zone_update')]
        for node in nodes:
            node.decorator_list = []
        messages = []
        socket = Socket(chunks)
        namespace = dict(client=socket, recv_buffer=b'', retry=0, read_list=[], json=json,
                         select=Mock(), _process_effect=lambda s, frame, zone: messages.append(frame),
                         _write_error=Mock(), respondFail=Mock())
        namespace['select'].select.return_value = ([socket], [], [])
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), 'exec'), namespace)
        zone = Mock(is_zone_running=True)
        return namespace, messages, socket, lambda: namespace['inject_zone_update'](lambda *args: None, zone, 1)

    def test_multiple_gifts_in_one_packet_are_each_dispatched(self):
        frames = [{'id': 1, 'code': 'addmoney_500'}, {'id': 2, 'code': 'mood_happy'}]
        namespace, received, _, tick = self.context([b''.join(json.dumps(x).encode()+b'\0' for x in frames)])
        tick()
        self.assertEqual(received, frames)
        self.assertEqual(namespace['recv_buffer'], b'')

    def test_partial_unicode_viewer_is_preserved_until_complete_frame(self):
        frame = json.dumps({'id': 3, 'code': 'addviewer', 'viewer': 'Léa 🐸'}, ensure_ascii=False).encode() + b'\0'
        index = frame.index('é'.encode()) + 1
        namespace, received, _, tick = self.context([frame[:index], frame[index:]])
        tick()
        self.assertEqual(received, [])
        tick()
        self.assertEqual(received[0]['viewer'], 'Léa 🐸')

    def test_one_engine_exception_does_not_drop_next_gift(self):
        namespace, received, _, tick = self.context([b'{"id":1,"code":"bad"}\0{"id":2,"code":"good"}\0'])
        def dispatch(socket, frame, zone):
            if frame['code'] == 'bad':
                raise RuntimeError('unavailable object')
            received.append(frame)
        namespace['_process_effect'] = dispatch
        tick()
        self.assertEqual([x['id'] for x in received], [2])
        self.assertEqual(namespace['respondFail'].call_args.args[1], 1)

    def test_disconnect_releases_socket_and_can_reconnect(self):
        namespace, _, socket, tick = self.context([b''])
        tick()
        self.assertTrue(socket.closed)
        self.assertIsNone(namespace['client'])
        self.assertGreater(namespace['retry'], 0)

import types

class EffectTests(unittest.TestCase):
    def context(self):
        parsed = ast.parse(SOURCE.read_text(encoding='utf8'))
        node = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == '_process_effect')
        service = Mock()
        service.active_sim_info.return_value.full_name = 'Test Sim'
        namespace = dict(services=service, check_sim=lambda sim: True,
                         respondRetry=Mock(), respondSuccess=Mock(), respondFail=Mock(), show_notification=Mock())
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SOURCE), 'exec'), namespace)
        zone = types.SimpleNamespace(is_in_build_buy=False)
        return namespace, service, lambda code: namespace['_process_effect'](Mock(), {'id': 4, 'code': code}, zone)

    def test_no_negative_leave_when_no_day_remains(self):
        ns, service, dispatch = self.context()
        career = Mock(pto=0)
        service.active_sim_info.return_value._career_tracker._careers = {1: career}
        dispatch('ptodown')
        career.add_pto.assert_not_called()
        ns['respondSuccess'].assert_not_called()
        ns['respondRetry'].assert_called_once()

    def test_teleport_uses_sim_and_accepts_three_placement_results(self):
        ns, service, dispatch = self.context()
        sim = service.get_active_sim.return_value
        sim.should_be_swimming_at_position.return_value = False
        ns.update(WalksStyleBehavior=types.SimpleNamespace(WALKSTYLES_OVERRIDE_TELEPORT=set()),
                  TeleportHelper=Mock(), placement=Mock(), routing=Mock(), ResetReason=types.SimpleNamespace(NONE=0))
        ns['TeleportHelper'].does_routing_slave_prevent_teleport.return_value = False
        ns['placement'].FGLSearchFlagsDefault = 1
        ns['placement'].FGLSearchFlag = types.SimpleNamespace(USE_SIM_FOOTPRINT=2, STAY_IN_CURRENT_BLOCK=4)
        ns['placement'].find_good_location.return_value = ('position', 'orientation', 'success')
        dispatch('teleport')
        self.assertIs(ns['placement'].create_fgl_context_for_sim.call_args.args[1], sim)
        ns['respondSuccess'].assert_called_once()
        ns['respondRetry'].assert_not_called()

    def test_fast_forward_keeps_current_time_of_day_for_exactly_one_day(self):
        ns, service, dispatch = self.context()
        simulate = Mock(_alarm_handle=None)
        ns.update(SimulateToTime=Mock(return_value=simulate), ClockSpeedMode=types.SimpleNamespace(SUPER_SPEED3=5))
        service.game_clock_service.return_value.now.return_value.hour.return_value = 17
        service.game_clock_service.return_value.now.return_value.minute.return_value = 23
        dispatch('warp')
        simulate.start.assert_called_once_with(17, 23, 1, 5)

if __name__ == '__main__':
    unittest.main()
