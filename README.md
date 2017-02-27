# choo-routehandler
This is a small route handling framework on top of [Choo](https://github.com/yoshuawuyts/choo).
Beware it's a work in progress and likely to change!!

The core feature of this framework is that it provides a function for wrapping your route handlers,
mitigating the need for writing boilerplate code. It requires three arguments: `view`, `loader`
and `layout`.

<dl>
  <dt>view</dt>
  <dd>Either a function, for rendering the view corresponding to the route, or a module containing
  at least a function <code>render</code> fulfilling the aforementioned responsibility, optionally
  a function <code>loadData</code> for loading data pertaining to the route before rendering it and
  optionally a function or attribute <code>pageTitle</code> for defining a route's page title.
  The loadData function should return a promise resolving to an object to patch Choo state with.</dd>

  <dt>loader</dt>
  <dd>An argument free function that should return a DOM element representing a loading screen.</dd>

  <dt>layout</dt>
  <dd>A function representing the layout of the view, that should take four arguments, the rendered
  view, <code>state</code>, <code>prev</code> and <code>send</code>, and return a DOM element.</dd>
</dl>

## Route Rendering

The route handler wrapper renders the view for your route inside a container element,
`#route-container`, possessing an attribute called `data-route`, which encodes the current route
and query string. It also registers a callback via a
[MutationObserver](https://developer.mozilla.org/en/docs/Web/API/MutationObserver) that triggers
when said attribute changes, in order to react as the rendered route changes. The reaction is
implemented as a Choo effect `handleRouteLoadedIntoDom`, which gets defined in the _model_ part
of the framework.

The behaviour of the route handler is to, once it detects that the currently rendered route changes
(including its query string), go through a standard procedure in order to render the corresponding
view, depending on whether or not there is a data loading hook for the route:

### With a Data Loading Hook
1. Invoke the `loadData` hook and render the loading view.
2. Once the `loadData` promise resolves, merge the resulting state subgraph into the Choo state
graph. Then call the `render` hook in order to render the view corresponding to the route.

### Without a Data Loading Hook
Just render the view corresponding to the route.

## The Model
The model, defined in the model.js file of the package (import as e.g.
`require('@arve.knudsen/choo-routehandler/model')`), defines state/effects/reducers required
by the framework.

## Example
```
const routeHandler = require('@arve.knudsen/choo-routehandler')
const routeHandlerModel = require('@arve.knudsen/choo-routehandler/model')
const app = require('choo')

const loading = require('./loading')
const layout = require('./layout')

app.model({
  state: {...}
})
routeHandlerModel(app)

app.router({default: '/404',}, [
  ['/404', routeHandler(notFoundView, loading, layout),],
  ['/', routeHandler(mainView, loading, layout),],
])
```
