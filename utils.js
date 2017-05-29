const reduce = require('ramda/src/reduce')
const pipe = require('ramda/src/pipe')
const sortBy = require('ramda/src/sortBy')
const prop = require('ramda/src/prop')
const fromPairs = require('ramda/src/fromPairs')
const S = require('underscore.string.fp')
const toPairs = require('ramda/src/toPairs')
const isEmpty = require('ramda/src/isEmpty')
const map = require('ramda/src/map')

const getQueryParameters = function (state) {
  var queryParameters
  if (typeof state.location.search === 'string') {
    // XXX: This is really a bug in Choo when calling effects, search should be encoded as an
    // object
    queryParameters = reduce(function (acc, str) {
      const delimited = S.wordsDelim('=', str)
      const key = delimited[0]
      const value = delimited[1]
      if (!S.isBlank(value || '')) {
        acc[key] = decodeURIComponent(value)
      }
      return acc
    }, {}, S.wordsDelim('&', state.location.search.slice(1)))
  } else {
    queryParameters = state.location.search
  }
  // Sort keys for consistency, so we can e.g. compare query parameter sets against each other
  return pipe(
    toPairs,
    sortBy(prop(0)),
    fromPairs
  )(queryParameters)
}

module.exports = {
  getQueryParameters: getQueryParameters,
  computeRouteString: function (state) {
    // Include query parameters in route representation, so that we'll trigger a reload when
    // they change and not just the route itself
    const queryParameters = getQueryParameters(state)
    var queryPart
    if (!isEmpty(queryParameters)) {
      queryPart = '?' + S.join('&', map(function (keyAndValue) {
        return keyAndValue[0] + '=' + (keyAndValue[1] || '')
      }, toPairs(queryParameters)))
    } else {
      queryPart = ''
    }
    return state.location.pathname + queryPart
  },
}
