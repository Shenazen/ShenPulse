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

if __name__ == '__main__':
    unittest.main()
