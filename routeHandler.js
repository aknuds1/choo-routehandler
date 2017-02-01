const assert = require('assert')
const isEmpty = require('ramda/src/isEmpty')
const h = require('hyperscript')
const onload = require('on-load')

const route2ViewAndParams = {}

module.exports = (view, state, prev, send, loader, layout) => {
  const {location,} = state
  const {pathname,} = location
  const viewRenderer = view.render != null ? view.render : view
  let renderer
  if (state.isLoading) {
    renderer = loader
  } else {
    if (view.loadData != null) {
      const loadingDataState = state.router.loadingDataState[pathname]
      if (loadingDataState == null) {
        send('enableScrollHandling', false)
        renderer = loader
      } else if (loadingDataState === 'loading') {
        renderer = loader
      } else {
        assert.equal(loadingDataState, 'loaded')
        renderer = viewRenderer
        if (state.disableScrollhandling) {
          send('enableScrollHandling', true)
        }
      }
    } else {
      if (!isEmpty(state.router.loadingDataState)) {
        send('clearLoadingDataState')
      }
      renderer = viewRenderer
    }
  }

  route2ViewAndParams[pathname] = [view, location.params,]
  const observer = new MutationObserver((mutations) => {
    assert.strictEqual(mutations[0].attributeName, 'data-route')
    assert.notEqual(location, null)
    send('handleRouteLoadedIntoDom', {route2ViewAndParams,})
  })
  const viewElement = h('#route-container', {
    'data-route': pathname,
    'data-router-loading-state': state.router.loadingDataState[pathname],
  }, renderer(state, prev, send))
  onload(viewElement, () => {
    observer.observe(viewElement, {attributes: true, attributeFilter: ['data-route',],})
    assert.notEqual(location, null)
    send('handleRouteLoadedIntoDom', {route2ViewAndParams,})
  }, () => {
    observer.disconnect()
  }, 'routeHandler')
  return layout(viewElement, state, send, view.leftColumnSections)
}
