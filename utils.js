const reduce = require('ramda/src/reduce')
const pipe = require('ramda/src/pipe')
const sortBy = require('ramda/src/sortBy')
const prop = require('ramda/src/prop')
const fromPairs = require('ramda/src/fromPairs')
const S = require('underscore.string.fp')
const toPairs = require('ramda/src/toPairs')

module.exports = {
  getQueryParameters: (state) => {
    let queryParameters
    if (typeof state.location.search === 'string') {
      // XXX: This is really a bug in Choo when calling effects, search should be encoded as an
      // object
      queryParameters = reduce((acc, str) => {
        const [key, value,] = S.wordsDelim('=', str)
        if (!isNullOrBlank(value)) {
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
  },
}
