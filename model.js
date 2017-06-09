const Promise = require('bluebird')
const assert = require('assert')
const merge = require('ramda/src/merge')
const equals = require('ramda/src/equals')

const utils = require('./utils')

const loadRouteDataFromCache = Promise.method(function (state, initialState, send) {
  assert.notEqual(state, null)
  assert.notEqual(send, null)
  const routeStr = utils.computeRouteString(state)
  const newState = merge(initialState, state.router.routeDataCache[routeStr] || {})
  return Promise.promisify(send)('haveLoadedRouteDataFromCache',
    {routeStr: routeStr, newState: newState,})
})

module.exports = function (app) {
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
      handleRouteLoadedIntoDom: function (state, opts, send, done) {
        const route2ViewAndParams = opts.route2ViewAndParams
        assert.notEqual(state.router.loadingDataState, null)
        const routeStr = utils.computeRouteString(state)
        const queryParameters = utils.getQueryParameters(state)
        // Get view module and URL parameters corresponding to route
        // XXX: Can't use params from state.location, as it's undefined in effects for some reason
        const viewAndParams = route2ViewAndParams[routeStr]
        const view = viewAndParams[0]
        const params = viewAndParams[1]
        assert.notEqual(view, null)
        const initialState = {
          router: merge(state.router, {
            currentRoute: routeStr,
          }),
        }
        var loadDataPromise
        if (view.loadData != null && (state.router.loadingDataState[routeStr] == null ||
            !equals(queryParameters, state.router.dataLoadingParameters[routeStr]))) {
          // The route's data hasn't been loaded or it was for different parameters
          loadDataPromise = Promise.promisify(send)('isLoadingRouteData', routeStr)
            .then(function () {
              return Promise.method(view.loadData)({state: state, params: params, send: send,})
                .then(function (newState) {
                  return Promise.promisify(send)('haveLoadedRouteData',
                    {routeStr: routeStr, initialState: initialState, newState: newState,})
                })
            })
        } else {
          loadDataPromise = loadRouteDataFromCache(state, initialState, send)
        }
        loadDataPromise
          .then(function () {
            const pageTitle = view.pageTitle
            return Promise.promisify(send)('setPageTitle', pageTitle)
          }, function (error) {
            if (error.type === 'notFound') {
              return Promise.promisify(send)('haveLoadedRouteData',
                  {routeStr: routeStr, initialState: initialState,})
                .then(function () {
                  return Promise.promisify(send)('location:set', '/404')
                })
            } else {
              throw error
            }
          })
          .then(function () {
            done()
          }, done)
      },
      setPageTitle: function (state, pageTitle, send, done) {
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
      isLoadingRouteData: function (state, routeStr) {
        const stateObj = {}
        stateObj[routeStr] = 'loading'
        const parametersObj = {}
        parametersObj[routeStr] = utils.getQueryParameters(state)
        return {
          disableScrollhandling: true,
          router: merge(state.router, {
            loadingDataState: merge(state.router.loadingDataState, stateObj),
            dataLoadingParameters: merge(state.router.dataLoadingParameters, parametersObj),
          }),
        }
      },
      haveLoadedRouteData: function (state, opts) {
        const routeStr = opts.routeStr
        const newState = opts.newState
        const initialState = opts.initialState
        if (routeStr === utils.computeRouteString(state)) {
          // The route in question is current
          const loadingDataPatch = {}
          // Mark the route as having had its data loaded
          loadingDataPatch[routeStr] = 'loaded'
          const stateBeforeLoading = merge(initialState, {
            router: merge(state.router, initialState.router),
          })
          const routeDataCachePatch = {}
          routeDataCachePatch[routeStr] = newState
          return merge(newState, merge(stateBeforeLoading, {
            router: merge(stateBeforeLoading.router, {
              loadingDataState: merge(state.router.loadingDataState, loadingDataPatch),
              routeDataCache: merge(state.router.routeDataCache, routeDataCachePatch),
            }),
          }))
        } else {
          return {}
        }
      },
      haveLoadedRouteDataFromCache: function (state, opts) {
        const routeStr = opts.routeStr
        const newState = opts.newState
        if (utils.computeRouteString(state) === routeStr) {
          // The route in question is current
          return newState
        } else {
          return {}
        }
      },
    },
  })
}
