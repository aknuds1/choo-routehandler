const assert = require('assert')
const h = require('@arve.knudsen/hyperscript')

const {computeRouteString,} = require('./utils')

const route2ViewAndParams = {}

const redirectToLogin = (opts, currentRoute, state, send) => {
  if (opts.requiresLogin) {
    assert.notEqual(opts.isUserLoggedIn, null)
    assert.notEqual(opts.loginUrl, null)
    if (opts.loginUrl !== currentRoute && !opts.isUserLoggedIn(state)) {
      send('location:set', opts.loginUrl)
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

// Wrapper for route views, which can either be modules or straight functions.
// Modules should contain at the very least a render function, but can also expose a loadData
// function for loading data ahead of rendering. If the latter kind of function is supplied,
// a loader element is rendered for the route until the data is loaded
module.exports = (view, loader, layout, opts={}) => {
  const routeHandler = (state, prev, send) => {
    const {location,} = state
    if (!redirectToLogin(opts, location.pathname, state, send)) {
      const viewRenderer = view.render != null ? view.render : view
      const routeStr = computeRouteString(state)
      let renderer
      if (state.isLoading) {
        renderer = loader
      } else if (state.router.currentRoute !== routeStr) {
        // The route being rendered differs from the one we've computed our state for, await
        // state catching up
        renderer = loader
      } else {
        if (view.loadData != null) {
          // The view module has a hook for loading data
          // Figure out the data loading state for the current route
          const loadingDataState = state.router.loadingDataState[routeStr] || 'loading'
          if (loadingDataState === 'loading') {
            renderer = loader
          } else {
            assert.equal(loadingDataState, 'loaded')
            renderer = viewRenderer
          }
        } else {
          renderer = viewRenderer
        }
      }

      // Memorize the view module and URL parameters for the route synchronously, as opposed to
      // updating the state, which would be an async operation
      route2ViewAndParams[routeStr] = [view, location.params,]
      // Observe changes to data-route parameter of route container, since we want to react
      // synchronously to a new route being rendered.
      const observer = new MutationObserver((mutations) => {
        assert.strictEqual(mutations[0].attributeName, 'data-route')
        send('handleRouteLoadedIntoDom', {route2ViewAndParams,})
      })
      const rendered = renderer(state, prev, send)
      // Render a container for the route view, which we can observe to see when a new route is
      // rendered
      const viewElement = h('#route-container', {
        'data-route': routeStr,
        onload: (element) => {
          observer.observe(element, {attributes: true, attributeFilter: ['data-route',],})
          send('handleRouteLoadedIntoDom', {route2ViewAndParams,})
        },
        onunload: () => {
          observer.disconnect()
        },
      }, rendered)
      return layout(viewElement, state, prev, send)
    } else {
      return loader()
    }
  }

  return routeHandler
}
