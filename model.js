const Promise = require('bluebird')
const assert = require('assert')
const merge = require('ramda/src/merge')
const equals = require('ramda/src/equals')

const {getQueryParameters,} = require('./utils')

const loadRouteDataFromCache = Promise.method((state, send) => {
  assert.notEqual(state, null)
  assert.notEqual(send, null)
  const route = state.location.pathname
  const newState = state.router.routeDataCache[route]
  return Promise.promisify(send)('haveLoadedRouteDataFromCache',
    {route, newState,})
})

module.exports = (app) => {
  app.model({
    state: {},
    effects: {
      // React to new route being loaded into DOM, which should trigger fetching its data and
      // then rendering the corresponding view once its data is ready
      handleRouteLoadedIntoDom: (state, {route2ViewAndParams,}, send, done) => {
        const location = state.location
        const queryParameters = getQueryParameters(state)
        // Get view module and URL parameters corresponding to route
        // XXX: Can't use params from state.location, as it's undefined in effects for some reason
        const [view, params,] = route2ViewAndParams[location.pathname]
        assert.notEqual(view, null)
        let loadDataPromise
        if (view.loadData != null && (state.router.loadingDataState[location.pathname] == null ||
            !equals(queryParameters, state.router.dataLoadingParameters[location.pathname]))) {
          // The route's data hasn't been loaded or it was for different parameters
          loadDataPromise = Promise.promisify(send)('isLoadingRouteData', location.pathname)
            .then(() => {
              return Promise.method(view.loadData)({state, params, send,})
                .then((newState) => {
                  return Promise.promisify(send)('haveLoadedRouteData', {location, newState,})
                }, (error) => {
                  if (error.type === 'notFound') {
                    return Promise.promisify(send)('haveLoadedRouteData', {location, newState: {},})
                      .then(() => {
                        return Promise.promisify(send)('location:set', '/404')
                      })
                  } else {
                    throw error
                  }
                })
            })
        } else {
          loadDataPromise = loadRouteDataFromCache(state, send)
        }
        loadDataPromise
          .then(() => {
            const pageTitle = view.pageTitle
            return Promise.promisify(send)('setPageTitle', pageTitle)
          })
          .then(() => {
            done()
          }, done)
      },
      setPageTitle: (state, pageTitle, send, done) => {
        if (typeof pageTitle === 'function') {
          pageTitle = pageTitle(state)
        }
        document.title = pageTitle
        done()
      },
    },
    reducers: {
      isLoadingRouteData: (state, pathname) => {
        const stateObj = {}
        stateObj[pathname] = 'loading'
        const parametersObj = {}
        parametersObj[pathname] = getQueryParameters(state)
        return {
          disableScrollhandling: true,
          router: merge(state.router, {
            loadingDataState: merge(state.router.loadingDataState, stateObj),
            dataLoadingParameters: merge(state.router.dataLoadingParameters, parametersObj),
          }),
        }
      },
      haveLoadedRouteData: (state, {location, newState,}) => {
        if (location.pathname === state.location.pathname) {
          // The route in question is current
          const loadingDataPatch = {}
          // Mark the route as having had its data loaded
          loadingDataPatch[location.pathname] = 'loaded'
          const routeDataCachePatch = {}
          routeDataCachePatch[location.pathname] = newState
          return merge(newState, {
            router: merge(state.router, {
              loadingDataState: merge(state.router.loadingDataState, loadingDataPatch),
              routeDataCache: merge(state.router.routeDataCache, routeDataCachePatch),
            }),
          })
        } else {
          return {}
        }
      },
      haveLoadedRouteDataFromCache: (state, {route, newState,}) => {
        if (location.pathname === route) {
          // The route in question is current
          return newState
        } else {
          return {}
        }
      },
    },
  })
}
