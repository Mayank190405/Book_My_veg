import morgan from "morgan";
import logger from "../utils/logger";

const stream = {
    write: (message: string) => logger.http(message.trim()),
};

const skip = () => {
    return false;
};

export const requestLogger = morgan(
    ":remote-addr :method :url :status :res[content-length] - :response-time ms",
    { stream, skip }
);
