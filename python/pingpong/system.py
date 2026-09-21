import asyncio
from tdpnet import StandardSession


class System(StandardSession):
    def __init__(self, config: dict, connect: bool = True):
        super().__init__()
        self.config = config

        if connect:
            # Wrap the coroutine in create_task so it actually runs on the event loop
            asyncio.create_task(self.connect(self.host, self.ssl))

    @property
    def ssl(self):
        return self.config.get('ssl')

    @property
    def host(self):
        return self.config.get('host')

    @property
    def credential(self):
        return self.config.get('credential', {})

    @property
    def address(self):
        return self.credential.get('address')

    @property
    def peers(self):
        return self.config.get('peers', {})

    def on_connected(self, timestamp: int):
        asyncio.create_task(self.signin(self.credential))

    def on_granted(self, data):
        pass

    def on_denied(self, data):
        pass