import logging
import asyncio
import signal
import functools

from sanic import Sanic, SanicException, response
from sanic.mixins.startup import ServerStage, all_tasks, suppress


def stop_sanic_app(app: Sanic, name: str) -> None:
    if hasattr(app.ctx, "shutting_down"):
        return

    app.ctx.shutting_down = True
    logging.info(f"Processing {name} signal...")

    # This is part of app.stop() method. We use it, because we must NOT do get_event_loop().stop()
    # before all the tasks were shutdown.
    if app.state.stage is not ServerStage.STOPPED:
        app.shutdown_tasks(timeout=0)
        for task in all_tasks():
            with suppress(AttributeError):
                if task.get_name() == "RunServer":
                    task.cancel()


async def catch_signals(app: Sanic) -> None:
    running_loop = asyncio.get_running_loop()
    for name in {'SIGINT', 'SIGTERM'}:
        try:
            running_loop.add_signal_handler(
                getattr(signal, name),
                functools.partial(stop_sanic_app, app, name))
        except NotImplementedError:
            logging.warning("Signals are not implemented. App would not be shut down gracefully.")
            break


def register_custom_error_handler(app: Sanic):
    """
    Utility function to register a custom error handler for the Sanic app.
    It will catch all Sanic exceptions and return a custom error response.

    :param app: The Sanic application instance.
    """

    @app.exception(SanicException)
    async def custom_error_handler(request, exception):
        status_code = getattr(exception, 'status_code', 500)
        if hasattr(exception, 'message'):
            error_message = exception.message
        else:
            error_message = exception.__class__.__name__ if hasattr(exception, '__class__') else "Unknown Error"
        return response.json(
            {
                "status": status_code,
                "error": error_message,
                "message": str(exception.args[0] if exception.args else "Unknown error occurred")
            },
            status=status_code)
