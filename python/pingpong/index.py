import asyncio
import time
from config import config
from system import System


class Application(System):
    def __init__(self):
        super().__init__(config['ponpin'])

    def on_denied(self, data):
        print('denied', data)

    def on_granted(self, data):
        print('granted', data)
        asyncio.create_task(
            self.request(self.address, self.peers.get('pinpon'), 'ping', 0)
        )
        # asyncio.create_task(self.notify(self.address, 'pinpon.aladino.maya.4da', 'pong', 0))

    def on_event(self, id_val: str, packet):
        to = packet.peering.from_peer
        print('event', id_val, to, int(time.time() * 1000))
        if id_val == 'ping':
            asyncio.create_task(self._delayed_notify(to, 'pong', 0, delay=2))

    def on_response(self, id_val: str, packet):
        print('response', id_val, int(time.time() * 1000))
        if id_val == 'pong':
            asyncio.create_task(self._delayed_response(packet, 'ping', 1, delay=2))

    def on_request(self, id_val: str, packet):
        print('request', id_val, int(time.time() * 1000))
        if id_val == 'pong':
            asyncio.create_task(self._delayed_response(packet, 'ping', 1, delay=1))

    # Helper methods to simulate JS setTimeout
    async def _delayed_notify(self, to: str, event_id: str, data, delay: float):
        await asyncio.sleep(delay)
        await self.notify(self.address, to, event_id, data)

    async def _delayed_response(self, packet, response_id: str, data, delay: float):
        await asyncio.sleep(delay)
        await self.response(packet, response_id, data)


async def main():
    app = Application()
    await app.connect(app.host, app.ssl)
    await asyncio.Event().wait() # Keep loop running

if __name__ == '__main__':
    asyncio.run(main())
    