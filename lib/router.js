/**
 * RESTful resource routing middleware for koa.
 *
 * @author Alex Mingoia <talk@alexmingoia.com>
 * @link https://github.com/alexmingoia/koa-router
 */

const debug = require("debug")("koa-router");
const compose = require("koa-compose");
const HttpError = require("http-errors");
// 数组【http.METHODS】的小写版本
const methods = require("methods");
const Layer = require("./layer");
const { pathToRegexp } = require("path-to-regexp");

/**
 * @module koa-router
 */

module.exports = Router;

/**
 * Create a new router.
 *
 * @example
 *
 * Basic usage:
 *
 * ```javascript
 * const Koa = require('koa');
 * const Router = require('@koa/router');
 *
 * const app = new Koa();
 * const router = new Router();
 *
 * router.get('/', (ctx, next) => {
 *   // ctx.router available
 * });
 *
 * app
 *   .use(router.routes())
 *   .use(router.allowedMethods());
 * ```
 *
 * @alias module:koa-router
 * @param {Object=} opts
 * @param {String=} opts.prefix prefix router paths
 * @constructor
 */

function Router(opts) {
  // 强制按构造函数使用
  if (!(this instanceof Router)) return new Router(opts);

  this.opts = opts || {};
  this.methods = this.opts.methods || ["HEAD", "OPTIONS", "GET", "PUT", "PATCH", "POST", "DELETE"];

  // 从Router.prototype.param可知，router的params存的是中间件，键名为param
  this.params = {};
  this.stack = [];
}

/**
 * Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
 * as `router.get()` or `router.post()`.
 *
 * Match URL patterns to callback functions or controller actions using `router.verb()`,
 * where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.
 *
 * Additionaly, `router.all()` can be used to match against all methods.
 *
 * ```javascript
 * router
 *   .get('/', (ctx, next) => {
 *     ctx.body = 'Hello World!';
 *   })
 *   .post('/users', (ctx, next) => {
 *     // ...
 *   })
 *   .put('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .del('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .all('/users/:id', (ctx, next) => {
 *     // ...
 *   });
 * ```
 *
 * When a route is matched, its path is available at `ctx._matchedRoute` and if named,
 * the name is available at `ctx._matchedRouteName`
 *
 * Route paths will be translated to regular expressions using
 * [path-to-regexp](https://github.com/pillarjs/path-to-regexp).
 *
 * Query strings will not be considered when matching requests.
 *
 * #### Named routes
 *
 * Routes can optionally have names. This allows generation of URLs and easy
 * renaming of URLs during development.
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *  // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 * ```
 *
 * #### Multiple middleware
 *
 * Multiple middleware may be given:
 *
 * ```javascript
 * router.get(
 *   '/users/:id',
 *   (ctx, next) => {
 *     return User.findOne(ctx.params.id).then(function(user) {
 *       ctx.user = user;
 *       next();
 *     });
 *   },
 *   ctx => {
 *     console.log(ctx.user);
 *     // => { id: 17, name: "Alex" }
 *   }
 * );
 * ```
 *
 * ### Nested routers
 *
 * Nesting routers is supported:
 *
 * ```javascript
 * const forums = new Router();
 * const posts = new Router();
 *
 * posts.get('/', (ctx, next) => {...});
 * posts.get('/:pid', (ctx, next) => {...});
 * forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());
 *
 * // responds to "/forums/123/posts" and "/forums/123/posts/123"
 * app.use(forums.routes());
 * ```
 *
 * #### Router prefixes
 *
 * Route paths can be prefixed at the router level:
 *
 * ```javascript
 * const router = new Router({
 *   prefix: '/users'
 * });
 *
 * router.get('/', ...); // responds to "/users"
 * router.get('/:id', ...); // responds to "/users/:id"
 * ```
 *
 * #### URL parameters
 *
 * Named route parameters are captured and added to `ctx.params`.
 *
 * ```javascript
 * router.get('/:category/:title', (ctx, next) => {
 *   console.log(ctx.params);
 *   // => { category: 'programming', title: 'how-to-node' }
 * });
 * ```
 *
 * The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
 * used to convert paths to regular expressions.
 *
 * @name get|put|post|patch|delete|del
 * @memberof module:koa-router.prototype
 * @param {String} path
 * @param {Function=} middleware route middleware(s)
 * @param {Function} callback route callback
 * @returns {Router}
 */
// 和后面的all方法类似，内部都会对path和method以及对应的中间件等进行注册
// 区别：这些方法只会针对path注册一个method，all方法会注册所有method
for (let i = 0; i < methods.length; i++) {
  function setMethodVerb(method) {
    Router.prototype[method] = function (name, path, middleware) {
      if (typeof path === "string" || path instanceof RegExp) {
        // 三参数+任意多中间件情况
        middleware = Array.prototype.slice.call(arguments, 2);
      } else {
        // 两参数+任意多中间件情况
        middleware = Array.prototype.slice.call(arguments, 1);
        path = name;
        name = null;
      }

      this.register(path, [method], middleware, {
        name: name,
      });

      return this;
    };
  }
  setMethodVerb(methods[i]);
}

// Alias for `router.delete()` because delete is a reserved word
Router.prototype.del = Router.prototype["delete"];

/**
 * Use given middleware.
 *
 * Middleware run in the order they are defined by `.use()`. They are invoked
 * sequentially, requests start at the first middleware and work their way
 * "down" the middleware stack.
 *
 * @example
 *
 * ```javascript
 * // session middleware will run before authorize
 * router
 *   .use(session())
 *   .use(authorize());
 *
 * // use middleware only with given path
 * router.use('/users', userAuth());
 *
 * // or with an array of paths
 * router.use(['/users', '/admin'], userAuth());
 *
 * app.use(router.routes());
 *
 * // 嵌套路由
 * const Router = require("koa-router");
 * const user = require("./user");
 * const router = new Router();
 * router.use("/user", user.routes(), user.allowedMethods());
 *
 * @param {String=} path
 * @param {Function} middleware
 * @param {Function=} ...
 * @returns {Router}
 */

Router.prototype.use = function () {
  const router = this;
  const middleware = Array.prototype.slice.call(arguments);
  let path;

  // support array of paths
  // 例：router.use(["/users", "/admin"], userAuth());
  if (Array.isArray(middleware[0]) && typeof middleware[0][0] === "string") {
    let arrPaths = middleware[0]; // ["/users", "/admin"]
    for (let i = 0; i < arrPaths.length; i++) {
      const p = arrPaths[i];
      // 为路由的每个path绑定userAuth中间件
      router.use.apply(router, [p].concat(middleware.slice(1)));
    }

    return this;
  }

  const hasPath = typeof middleware[0] === "string";
  if (hasPath) path = middleware.shift();

  for (let i = 0; i < middleware.length; i++) {
    const m = middleware[i];
    // 如果中间件是由路由生成的
    if (m.router) {
      // router.prototype.routes生成的大中间件带有router属性，(指向【使用说明】中的嵌套路由)
      // Object.assign(target, ...source);//将各source可枚举属性分配到target，并返回target
      const cloneRouter = Object.assign(Object.create(Router.prototype), m.router, {
        stack: m.router.stack.slice(0),
      });

      for (let j = 0; j < cloneRouter.stack.length; j++) {
        const nestedLayer = cloneRouter.stack[j];
        const cloneLayer = Object.assign(Object.create(Layer.prototype), nestedLayer);

        // 整合“被”嵌套【路由表】的前缀
        if (path) cloneLayer.setPrefix(path);
        if (router.opts.prefix) cloneLayer.setPrefix(router.opts.prefix);
        // 将被嵌套路由的路由表，整合后归入此router中
        router.stack.push(cloneLayer);
        cloneRouter.stack[j] = cloneLayer;
      }

      // 同样也需要处理参数前置中间件
      if (router.params) {
        function setRouterParams(paramArr) {
          const routerParams = paramArr;
          for (let j = 0; j < routerParams.length; j++) {
            const key = routerParams[j];
            cloneRouter.param(key, router.params[key]);
          }
        }
        setRouterParams(Object.keys(router.params));
      }
    } else {
      // 普通中间件，路径的任何请求方法都会"执行"
      // 可在Router.prototype.match的matched的pathAndMethod的收集发现
      const keys = [];
      pathToRegexp(router.opts.prefix || "", keys);
      const routerPrefixHasParam = router.opts.prefix && keys.length;
      // 注册一个没有method但有中间件m的【路由表】实例，满足该path的通用路由表
      // 只要访问的接口满足此path，必会命中此路由表实例
      router.register(path || "([^/]*)", [], m, {
        end: false,
        ignoreCaptures: !hasPath && !routerPrefixHasParam,
      });
    }
  }

  return this;
};

/**
 * Set the path prefix for a Router instance that was already initialized.
 *
 * @example
 *
 * ```javascript
 * router.prefix('/things/:thing_id')
 * ```
 *
 * @param {String} prefix
 * @returns {Router}
 */

Router.prototype.prefix = function (prefix) {
  prefix = prefix.replace(/\/$/, "");

  this.opts.prefix = prefix;

  for (let i = 0; i < this.stack.length; i++) {
    const route = this.stack[i];
    route.setPrefix(prefix);
  }

  return this;
};

/**
 * Returns router middleware which dispatches a route matching the request.
 *
 * @returns {Function}
 */

Router.prototype.routes = Router.prototype.middleware = function () {
  const router = this;

  let dispatch = function dispatch(ctx, next) {
    debug("ctx.method----->%s; ctx.path------>%s", ctx.method, ctx.path);

    const path = router.opts.routerPath || ctx.routerPath || ctx.path;
    const matched = router.match(path, ctx.method);
    console.log("matched------", matched);

    let layerChain;

    // 挂到ctx上，为后续的allowedMethods中间件准备
    if (ctx.matched) {
      // let p = [1,2]; p.push.apply(p,[3,4]); p则为[1,2,3,4]
      ctx.matched.push.apply(ctx.matched, matched.path);
    } else {
      ctx.matched = matched.path;
    }

    ctx.router = router;

    // 路径方法有一个没匹配上就跳到下一个中间件
    if (!matched.route) return next();

    const matchedLayers = matched.pathAndMethod;
    const mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
    ctx._matchedRoute = mostSpecificLayer.path;
    if (mostSpecificLayer.name) {
      ctx._matchedRouteName = mostSpecificLayer.name;
    }
    // 产生一批中间件，每次将一些信息挂到ctx上
    // matchedLayers：满足path和method的路由表，包括通用路由表
    layerChain = matchedLayers.reduce(function (memo, layer) {
      memo.push(function (ctx, next) {
        ctx.captures = layer.captures(path, ctx.captures); //第二个参数没用
        // 挂载路径参数信息
        ctx.params = ctx.request.params = layer.params(path, ctx.captures, ctx.params);
        ctx.routerPath = layer.path;
        ctx.routerName = layer.name;
        ctx._matchedRoute = layer.path;
        if (layer.name) {
          ctx._matchedRouteName = layer.name;
        }
        return next();
      });
      // memo合并【路由表】自带的中间件
      return memo.concat(layer.stack);
    }, []);
    // 返回Promise对象
    return compose(layerChain)(ctx, next);
  };
  // 将router挂到此中间件上，【Router.prototype.use中有用来判断是否为嵌套路由】
  // 标记：此中间件是由路由生成的
  dispatch.router = this;
  // 一旦执行，所有在此处构建的中间件链都会执行一遍
  return dispatch;
};

/**
 * Returns separate middleware for responding to `OPTIONS` requests with
 * an `Allow` header containing the allowed methods, as well as responding
 * with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.
 *
 * @example
 *
 * ```javascript
 * const Koa = require('koa');
 * const Router = require('@koa/router');
 *
 * const app = new Koa();
 * const router = new Router();
 *
 * app.use(router.routes());
 * app.use(router.allowedMethods());
 * ```
 *
 * **Example with [Boom](https://github.com/hapijs/boom)**
 *
 * ```javascript
 * const Koa = require('koa');
 * const Router = require('@koa/router');
 * const Boom = require('boom');
 *
 * const app = new Koa();
 * const router = new Router();
 *
 * app.use(router.routes());
 * app.use(router.allowedMethods({
 *   throw: true,
 *   notImplemented: () => new Boom.notImplemented(),
 *   methodNotAllowed: () => new Boom.methodNotAllowed()
 * }));
 * ```
 *
 * @param {Object=} options
 * @param {Boolean=} options.throw throw error instead of setting status and header
 * @param {Function=} options.notImplemented throw the returned value in place of the default NotImplemented error
 * @param {Function=} options.methodNotAllowed throw the returned value in place of the default MethodNotAllowed error
 * @returns {Function}
 */

Router.prototype.allowedMethods = function (options) {
  options = options || {};
  const implemented = this.methods;

  return function allowedMethods(ctx, next) {
    return next().then(function () {
      const allowed = {};

      if (!ctx.status || ctx.status === 404) {
        for (let i = 0; i < ctx.matched.length; i++) {
          const route = ctx.matched[i];
          for (let j = 0; j < route.methods.length; j++) {
            const method = route.methods[j];
            allowed[method] = method;
          }
        }

        const allowedArr = Object.keys(allowed);

        if (!~implemented.indexOf(ctx.method)) {
          if (options.throw) {
            let notImplementedThrowable =
              typeof options.notImplemented === "function"
                ? options.notImplemented() // set whatever the user returns from their function
                : new HttpError.NotImplemented();

            throw notImplementedThrowable;
          } else {
            ctx.status = 501;
            // 这个set是context代理response的set，用来设置响应头
            ctx.set("Allow", allowedArr.join(", "));
          }
        } else if (allowedArr.length) {
          if (ctx.method === "OPTIONS") {
            ctx.status = 200;
            ctx.body = "";
            ctx.set("Allow", allowedArr.join(", "));
          } else if (!allowed[ctx.method]) {
            if (options.throw) {
              let notAllowedThrowable =
                typeof options.methodNotAllowed === "function"
                  ? options.methodNotAllowed() // set whatever the user returns from their function
                  : new HttpError.MethodNotAllowed();

              throw notAllowedThrowable;
            } else {
              // 服务器未设置应对对此【请求方式】的路由,比如没设置router.post
              ctx.status = 405;
              ctx.set("Allow", allowedArr.join(", "));
            }
          }
        }
      }
    });
  };
};

/**
 * Register route with all methods.
 *
 * @param {String} name Optional.
 * @param {String} path
 * @param {Function=} middleware You may also pass multiple middleware.
 * @param {Function} callback
 * @returns {Router}
 * @private
 */
// 为该路径注册所有的请求方式(method)，redirect中使用过
Router.prototype.all = function (name, path, middleware) {
  if (typeof path === "string") {
    middleware = Array.prototype.slice.call(arguments, 2);
  } else {
    middleware = Array.prototype.slice.call(arguments, 1);
    path = name;
    name = null;
  }

  this.register(path, methods, middleware, { name });

  return this;
};

/**
 * Redirect `source` to `destination` URL with optional 30x status `code`.
 *
 * Both `source` and `destination` can be route names.
 *
 * ```javascript
 * router.redirect('/login', 'sign-in');
 * ```
 *
 * This is equivalent to:
 *
 * ```javascript
 * router.all('/login', ctx => {
 *   ctx.redirect('/sign-in');
 *   ctx.status = 301;
 * });
 * ```
 *
 * @param {String} source URL or route name.
 * @param {String} destination URL or route name.
 * @param {Number=} code HTTP status code (default: 301).
 * @returns {Router}
 */

Router.prototype.redirect = function (source, destination, code) {
  // lookup source route by name
  if (source[0] !== "/") source = this.url(source);

  // lookup destination route by name
  if (destination[0] !== "/" && !destination.includes("://")) destination = this.url(destination);

  // 此路径下所有请求方法都注册此中间件，访问source，就告诉浏览器跳转到destination
  return this.all(source, (ctx) => {
    ctx.redirect(destination);
    ctx.status = code || 301;
  });
};

/**
 * Create and register a route.
 *
 * @param {String} path Path string.
 * @param {Array.<String>} methods Array of HTTP verbs.
 * @param {Function} middleware Multiple middleware also accepted.
 * @returns {Layer}
 * @private
 */

Router.prototype.register = function (path, methods, middleware, opts) {
  opts = opts || {};

  const router = this;
  const stack = this.stack;

  // support array of paths
  if (Array.isArray(path)) {
    for (let i = 0; i < path.length; i++) {
      const curPath = path[i];
      router.register.call(router, curPath, methods, middleware, opts);
    }

    return this;
  }

  // create route - 将路径，方法，中间件和对应配置组合成一个结构
  const route = new Layer(path, methods, middleware, {
    end: opts.end === false ? opts.end : true,
    name: opts.name,
    // route自身的配置优先于router对象的配置，可对每个route精确控制
    sensitive: opts.sensitive || this.opts.sensitive || false,
    strict: opts.strict || this.opts.strict || false,
    prefix: opts.prefix || this.opts.prefix || "",
    ignoreCaptures: opts.ignoreCaptures,
  });

  if (this.opts.prefix) {
    route.setPrefix(this.opts.prefix);
  }

  // add parameter middleware
  for (let i = 0; i < Object.keys(this.params).length; i++) {
    const param = Object.keys(this.params)[i];
    route.param(param, this.params[param]);
  }

  stack.push(route);

  debug("defined route %s %s", route.methods, route.path);

  return route;
};

/**
 * Lookup route with given `name`.
 *
 * @param {String} name
 * @returns {Layer|false}
 */

Router.prototype.route = function (name) {
  const routes = this.stack;

  for (let len = routes.length, i = 0; i < len; i++) {
    if (routes[i].name && routes[i].name === name) return routes[i];
  }

  return false;
};

/**
 * Generate URL for route. Takes a route name and map of named `params`.
 *
 * @example
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *   // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 *
 * router.url('user', { id: 3 });
 * // => "/users/3"
 *
 * router.use((ctx, next) => {
 *   // redirect to named route
 *   ctx.redirect(ctx.router.url('sign-in'));
 * })
 *
 * router.url('user', { id: 3 }, { query: { limit: 1 } });
 * // => "/users/3?limit=1"
 *
 * router.url('user', { id: 3 }, { query: "limit=1" });
 * // => "/users/3?limit=1"
 * ```
 *
 * @param {String} name route name
 * @param {Object} params url parameters
 * @param {Object} [options] options parameter
 * @param {Object|String} [options.query] query options
 * @returns {String|Error}
 */

Router.prototype.url = function (name, params) {
  const route = this.route(name);

  if (route) {
    const args = Array.prototype.slice.call(arguments, 1);
    return route.url.apply(route, args);
  }

  return new Error(`No route found for name: ${name}`);
};

/**
 * Match given `path` and return corresponding routes.
 *
 * @param {String} path
 * @param {String} method
 * @returns {Object.<path, pathAndMethod>} returns layers that matched path and
 * path and method.
 * @private
 */
// path结构：protocol :// hostname[:port] / path / [;parameters][?query]#fragment
// path: 一个真实path；method: get ,post...
// 根据路径和请求方式，返回满足条件的路由表信息
Router.prototype.match = function (path, method) {
  const layers = this.stack;
  let layer;
  // 匹配对象：
  // path数组：仅路径匹配；
  // pathAndMethod数组：路径和请求方式匹配，可以包含拥有路由级别中间件的路由表；
  // route标志：pathAndMethod中是否存在同时满足路径和请求方式的匹配；
  const matched = {
    path: [],
    pathAndMethod: [],
    route: false,
  };

  for (let len = layers.length, i = 0; i < len; i++) {
    layer = layers[i];

    debug("test %s %s", layer.path, layer.regexp);
    // 遍历所有【路由表】
    if (layer.match(path)) {
      // 收集路径匹配的
      matched.path.push(layer);
      // -1取反为0，此处如果为真则证明找到了method
      // 条件1. 如果没有请求方式(method)，则该【路由表】保存的为路由级别中间件
      // 条件2. 要么保存的请求方式methods包含这个method - 路由请求方法也被匹配
      // 隐含：同一个循环if两个条件不可能同时成立，要么1，要么2
      if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) {
        matched.pathAndMethod.push(layer);
        // 访问http://localhost:3001/foo/3 可以同时匹配get方式"/foo/:id"和"/foo/3"
        // route标志：pathAndMethod数组保存的路由表中存在完全匹配path和请求方法method
        if (layer.methods.length) matched.route = true;
      }
    }
  }

  return matched;
};

/**
 * Run middleware for named route parameters. Useful for auto-loading or
 * validation.
 *
 * @example
 *
 * ```javascript
 * router
 *   .param('user', (id, ctx, next) => {
 *     ctx.user = users[id];
 *     if (!ctx.user) return ctx.status = 404;
 *     return next();
 *   })
 *   .get('/users/:user', ctx => {
 *     ctx.body = ctx.user;
 *   })
 *   .get('/users/:user/friends', ctx => {
 *     return ctx.user.getFriends().then(function(friends) {
 *       ctx.body = friends;
 *     });
 *   })
 *   // /users/3 => {"id": 3, "name": "Alex"}
 *   // /users/3/friends => [{"id": 4, "name": "TJ"}]
 * ```
 *
 * @param {String} param
 * @param {Function} middleware
 * @returns {Router}
 */
// 为路由的每一个路由表添加前置参数中间件
Router.prototype.param = function (param, middleware) {
  this.params[param] = middleware;
  for (let i = 0; i < this.stack.length; i++) {
    const route = this.stack[i];
    route.param(param, middleware);
  }

  return this;
};

/**
 * Generate URL from url pattern and given `params`.
 *
 * @example
 *
 * ```javascript
 * const url = Router.url('/users/:id', {id: 1});
 * // => "/users/1"
 * ```
 *
 * @param {String} path url pattern
 * @param {Object} params url parameters
 * @returns {String}
 */
Router.url = function (path) {
  const args = Array.prototype.slice.call(arguments, 1);
  return Layer.prototype.url.apply({ path }, args);
};
