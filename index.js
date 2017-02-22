const assert = require('assert')
const isEmpty = require('ramda/src/isEmpty')
const h = require('@arve.knudsen/hyperscript')
const map = require('ramda/src/map')
const toPairs = require('ramda/src/toPairs')
const S = require('underscore.string.fp')

const {getQueryParameters,} = require('./utils')

const route2ViewAndParams = {}

// Wrapper for route views, which can either be modules or straight functions.
// Modules should contain at the very least a render function, but can also expose a loadData
// function for loading data ahead of rendering. If the latter kind of function is supplied,
// a loader element is rendered for the route until the data is loaded
module.exports = (view, loader, layout) => {
  const routeHandler = (state, prev, send) => {
    const {location,} = state
    const {pathname,} = location
    const viewRenderer = view.render != null ? view.render : view
    const queryParameters = getQueryParameters(state)
    let renderer
    if (state.isLoading) {
      renderer = loader
    } else {
      if (view.loadData != null) {
        // The view module has a hook for loading data
        // Figure out the data loading state for the current route
        const loadingDataState = state.router.loadingDataState[pathname]
        if (loadingDataState == null) {
          // Data hasn't yet been loaded, we're about to, so show loader
          renderer = loader
        } else if (loadingDataState === 'loading') {
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
    route2ViewAndParams[pathname] = [view, location.params,]
    // Observe changes to data-route parameter of route container, since we want to react
    // synchronously to a new route being rendered.
    const observer = new MutationObserver((mutations) => {
      assert.strictEqual(mutations[0].attributeName, 'data-route')
      send('handleRouteLoadedIntoDom', {route2ViewAndParams,})
    })
    // Include query parameters in data-route, so that we'll trigger a reload when they change
    // and not just the route itself
    let queryPart
    if (!isEmpty(queryParameters)) {
      queryPart = '?' + S.join('&', map(([key, value,]) => {
        return `${key}=${value || ''}`
      }, toPairs(queryParameters)))
    } else {
      queryPart = ''
    }
    const rendered = renderer(state, prev, send)
    // Render a container for the route view, which we can observe to see when a new route is
    // rendered
    const viewElement = h('#route-container', {
      'data-route': `${pathname}${queryPart}`,
      onload: (element) => {
        observer.observe(element, {attributes: true, attributeFilter: ['data-route',],})
        send('handleRouteLoadedIntoDom', {route2ViewAndParams,})
      },
      onunload: () => {
        observer.disconnect()
      },
    }, rendered)
    return layout(viewElement, state, prev, send)
  }

  return routeHandler
}
