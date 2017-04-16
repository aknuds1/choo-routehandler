const Promise = require('bluebird')
const assert = require('assert')
const merge = require('ramda/src/merge')
const equals = require('ramda/src/equals')

const {getQueryParameters, computeRouteString,} = require('./utils')

const loadRouteDataFromCache = Promise.method((state, initialState, send) => {
  assert.notEqual(state, null)
  assert.notEqual(send, null)
  const routeStr = computeRouteString(state)
  const newState = merge(initialState, state.router.routeDataCache[routeStr] || {})
  return Promise.promisify(send)('haveLoadedRouteDataFromCache',
    {routeStr, newState,})
})

module.exports = (app) => {
  app.model({
    state: {
      router: {
        loadingDataState: {},
        loadingDataState: {},
        routeDataCache: {},
      },
    },
    effects: {
      // React to new route being loaded into DOM, which should trigger fetching its data and
      // then rendering the corresponding view once its data is ready
      handleRouteLoadedIntoDom: (state, {route2ViewAndParams,}, send, done) => {
        assert.notEqual(state.router.loadingDataState, null)
        const routeStr = computeRouteString(state)
        const queryParameters = getQueryParameters(state)
        // Get view module and URL parameters corresponding to route
        // XXX: Can't use params from state.location, as it's undefined in effects for some reason
        const [view, params,] = route2ViewAndParams[routeStr]
        assert.notEqual(view, null)
        const initialState = {
          router: merge(state.router, {
            currentRoute: routeStr,
          }),
        }
        let loadDataPromise
        if (view.loadData != null && (state.router.loadingDataState[routeStr] == null ||
            !equals(queryParameters, state.router.dataLoadingParameters[routeStr]))) {
          // The route's data hasn't been loaded or it was for different parameters
          loadDataPromise = Promise.promisify(send)('isLoadingRouteData', routeStr)
            .then(() => {
              return Promise.method(view.loadData)({state, params, send,})
                .then((newState) => {
                  return Promise.promisify(send)('haveLoadedRouteData',
                    {routeStr, initialState, newState,})
                })
            })
        } else {
          loadDataPromise = loadRouteDataFromCache(state, initialState, send)
        }
        loadDataPromise
          .then(() => {
            const pageTitle = view.pageTitle
            return Promise.promisify(send)('setPageTitle', pageTitle)
          }, (error) => {
            if (error.type === 'notFound') {
              return Promise.promisify(send)('haveLoadedRouteData',
                  {routeStr, initialState,})
                .then(() => {
                  return Promise.promisify(send)('location:set', '/404')
                })
            } else {
              throw error
            }
          })
          .then(() => {
            done()
          }, done)
      },
      setPageTitle: (state, pageTitle, send, done) => {
        if (typeof pageTitle === 'function') {
          pageTitle = pageTitle(state)
        }
        if (pageTitle != null) {
          assert.strictEqual(typeof pageTitle, 'string')
        }
        document.title = pageTitle
        done()
      },
    },
    reducers: {
      isLoadingRouteData: (state, routeStr) => {
        const stateObj = {}
        stateObj[routeStr] = 'loading'
        const parametersObj = {}
        parametersObj[routeStr] = getQueryParameters(state)
        return {
          disableScrollhandling: true,
          router: merge(state.router, {
            loadingDataState: merge(state.router.loadingDataState, stateObj),
            dataLoadingParameters: merge(state.router.dataLoadingParameters, parametersObj),
          }),
        }
      },
      haveLoadedRouteData: (state, {routeStr, newState, initialState,}) => {
        if (routeStr === computeRouteString(state)) {
          // The route in question is current
          const loadingDataPatch = {}
          // Mark the route as having had its data loaded
          loadingDataPatch[routeStr] = 'loaded'
          const stateBeforeLoading = merge(initialState, {
            router: merge(state.router, initialState.router),
          })
          const routeDataCachePatch = {}
          routeDataCachePatch[routeStr] = newState
          newState = merge(newState, merge(stateBeforeLoading, {
            router: merge(stateBeforeLoading.router, {
              loadingDataState: merge(state.router.loadingDataState, loadingDataPatch),
              routeDataCache: merge(state.router.routeDataCache, routeDataCachePatch),
            }),
          }))
          return newState
        } else {
          return {}
        }
      },
      haveLoadedRouteDataFromCache: (state, {routeStr, newState,}) => {
        if (computeRouteString(state) === routeStr) {
          // The route in question is current
          return newState
        } else {
          return {}
        }
      },
    },
  })
}
