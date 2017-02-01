const Promise = require('bluebird')
const assert = require('assert')
const merge = require('ramda/src/merge')

module.exports = (app) => {
  app.model({
    state: {},
    effects: {
      handleRouteLoadedIntoDom: (state, {route2ViewAndParams,}, send, done) => {
        const location = state.location
        // XXX: Can't use params from state.location, as it's undefined in effects for some reason
        const [view, params,] = route2ViewAndParams[location.pathname]
        assert.notEqual(view, null)
        let loadDataPromise
        if (view.loadData != null) {
          loadDataPromise = Promise.promisify(send)('isLoadingRouteData', location.pathname)
            .then(() => {
              return Promise.method(view.loadData)({state, params, send,})
                .then((newState) => {
                  return Promise.promisify(send)('haveLoadedRouteData', {location, newState,})
                }, (error) => {
                  if (error.type === 'notFound') {
                    return Promise.promisify(send)('haveLoadedRouteData', {location, newState: {},})
                      .then(() => {
                        window.location = '/404'
                      })
                  } else {
                    throw error
                  }
                })
            })
        } else {
          loadDataPromise = Promise.resolve()
        }
        loadDataPromise
          .then(() => {
            done()
          }, done)
      },
    },
    reducers: {
      clearLoadingDataState: () => {
        return {
          router: {
            loadingDataState: {},
          },
        }
      },
      isLoadingRouteData: (state, pathname) => {
        const stateObj = {}
        stateObj[pathname] = 'loading'
        return {
          disableScrollhandling: true,
          router: {
            loadingDataState: stateObj,
          },
        }
      },
      haveLoadedRouteData: (state, {location, newState,}) => {
        if (location.pathname === state.location.pathname) {
          const stateObj = {}
          stateObj[location.pathname] = 'loaded'
          return merge(newState, {
            router: {
              loadingDataState: stateObj,
            },
          })
        }
      },
      enableScrollHandling: (state, enable) => {
        return {
          disableScrollhandling: !enable,
        }
      },
    },
  })
}
