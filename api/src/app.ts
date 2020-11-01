import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import config from "./config/config";
import directory from "./routes/directory";
import morgan from "morgan";
import mongoose from "mongoose";
import { NotFoundError, UserInputError } from "./index";

const app: express.Express = express();
const mongoConfig = config.get("mongo");

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/", directory);

// catch 404 and forward to error handler
app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const err: any = new Error("Not Found");
    err.status = 404;
    next(err);
  }
);

// error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    if (err instanceof NotFoundError) {
      return res.status(404).send(res.locals);
    } else if (err instanceof UserInputError) {
      return res.status(400).send(res.locals);
    }
    // render the error page
    res.status(err.status || 500);
    res.send(res.locals);
  }
);

mongoose
  .connect(mongoConfig.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  .then(() => {
    console.log("Connected to Mongo");
  })
  .catch((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });

export { app };
