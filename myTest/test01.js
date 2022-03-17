const http = require("http");
const Koa = require("koa");
const Router = require("../lib/router");
const debug = require("debug")("myTest");

const app = new Koa();
const router = new Router();

router.get("/", (ctx, next) => {
  // ctx.router available
  debug("打印");
  // ctx.body = "hello";
});
router.use("/", (ctx, next) => {
  debug("路由使用了中间件");
  next();
});
router.post("/", (ctx, next) => {
  debug("路由使用了中间件");
  next();
});
router.del("/", (ctx, next) => {
  debug("路由使用了中间件");
  next();
});
router.get("/foo/:id", (ctx, next) => {
  debug("路由使用了中间件");
  next();
});
router.get("/foo/3", (ctx, next) => {
  debug("路由使用了中间件");
  next();
});
router.del("/foo", (ctx, next) => {
  debug("路由使用了中间件");
  next();
});
app.use(router.routes()).use(router.allowedMethods());

var server = http.createServer(app.callback());

server.listen(3001);
server.on("error", onError);
server.on("listening", onListening);

function onError(error) {
  debug(error);
}

function onListening() {
  var addr = server.address();
  debug("listening " + addr.port);
}
