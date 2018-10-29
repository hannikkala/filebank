import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as Promise from 'bluebird';
import { config } from './config';
import * as dirs from './routes/directory';
import morgan = require('morgan');
import mongoose = require('mongoose');

mongoose.Promise = Promise;

const app: express.Express = express();

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', dirs);

// catch 404 and forward to error handler
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const err : any = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send(res.locals);
});

mongoose.connect(config.mongoDbUrl, { useNewUrlParser: true }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

export = app;
