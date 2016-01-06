'use strict';

var Promise = require('core-js/library/es6/promise');
var angular = require('angular');

var events = require('./events');

var CACHE_TTL = 5 * 60 * 1000; // 5 minutes

var ACCOUNT_ACTIONS = [
  ['login', 'POST'],
  ['logout', 'POST'],
  ['profile', 'GET'],
  ['edit_profile', 'POST'],
  ['disable_user', 'POST']
];

function sessionActions(options) {
  var actions = {};

  // These map directly to views in `h.accounts`, and all have a similar form:
  for (var i = 0, len = ACCOUNT_ACTIONS.length; i < len; i++) {
    var name = ACCOUNT_ACTIONS[i][0];
    var method = ACCOUNT_ACTIONS[i][1];
    actions[name] = {
      method: method,
      params: {
        __formid__: name
      }
    };
  }

  // Finally, add a simple method for getting the current session state
  actions._load = {method: 'GET'};

  if (typeof options !== 'undefined') {
    for (var act in actions) {
      for (var opt in options) {
        actions[act][opt] = options[opt];
      }
    }
  }

  return actions;
}


/**
 * @ngdoc service
 * @name session
 * @description
 * Access to the application session and account actions. This service gives
 * other parts of the application access to parts of the server-side session
 * state (such as current authenticated userid, CSRF token, etc.).
 *
 * In addition, this service also provides helper methods for mutating the
 * session state, by, e.g. logging in, logging out, etc.
 *
 * @ngInject
 */
function session($document, $http, $resource, $rootScope, flash) {
  // Headers sent by every request made by the session service.
  var headers = {};
  // TODO: Move accounts data management (e.g. profile, edit_profile,
  // disable_user, etc) into another module with another route.
  var actions = sessionActions({
    headers: headers,
    transformResponse: process,
    withCredentials: true
  });
  var base = $document.prop('baseURI');
  var endpoint = new URL('/app', base).href;
  var resource = $resource(endpoint, {}, actions);

  // Blank initial model state
  resource.state = {};

  // Cache the result of _load()
  var lastLoad;
  var lastLoadTime;

  /**
   * @name session.dismissSidebarTutorial()
   * @description
   * Set session.state.show_sidebar_tutorial to false. The tutorial will not
   * be automatically shown to this user anymore.
   *
   */
  resource.dismissSidebarTutorial = function () {
    resource.state.show_sidebar_tutorial = false;
  };

  /**
   * @name session.load()
   * @description
   * Fetches the session data from the server. This function returns an object
   * with a $promise property which resolves to the session data.
   *
   * N.B. The data is cached for CACHE_TTL across all actions of the session
   * service: that is, a call to login() will update the session data and a call
   * within CACHE_TTL milliseconds to load() will return that data rather than
   * triggering a new request.
   */
  resource.load = function () {
    if (!lastLoadTime || (Date.now() - lastLoadTime) > CACHE_TTL) {
      lastLoad = resource._load();
      lastLoadTime = Date.now();
      // If the load fails, we need to clear out lastLoadTime so another load
      // attempt will succeed.
      lastLoad.$promise.catch(function () {
        lastLoadTime = null;
      });
    }

    return lastLoad;
  };

  /**
   * @name session.update()
   *
   * @description Update the session state using the provided data.
   *              This is a counterpart to load(). Whereas load() makes
   *              a call to the server and then updates itself from
   *              the response, update() can be used to update the client
   *              when new state has been pushed to it by the server.
   */
  resource.update = function (model) {
    var isInitialLoad = !resource.state.csrf;

    var userChanged = model.userid !== resource.state.userid;
    var groupsChanged = !angular.equals(model.groups, resource.state.groups);

    // Copy the model data (including the CSRF token) into `resource.state`.
    angular.copy(model, resource.state);

    // Set up subsequent requests to send the CSRF token in the headers.
    if (resource.state.csrf) {
      headers[$http.defaults.xsrfHeaderName] = resource.state.csrf;
    }

    // Replace lastLoad with the latest data, and update lastLoadTime.
    lastLoad = {$promise: Promise.resolve(model), $resolved: true};
    lastLoadTime = Date.now();

    $rootScope.$broadcast(events.SESSION_CHANGED, {
      initialLoad: isInitialLoad,
    });

    if (userChanged) {
      $rootScope.$broadcast(events.USER_CHANGED, {
        initialLoad: isInitialLoad,
      });
    }
    if (groupsChanged) {
      $rootScope.$broadcast(events.GROUPS_CHANGED, {
        initialLoad: isInitialLoad,
      });
    }

    // Return the model
    return model;
  };

  function process(data, headersGetter) {
    // Parse as json
    data = angular.fromJson(data);

    // Lift response data
    var model = data.model || {};
    if (typeof data.errors !== 'undefined') {
      model.errors = data.errors;
    }
    if (typeof data.reason !== 'undefined') {
      model.reason = data.reason;
    }

    // Fire flash messages.
    for (var type in data.flash) {
      if (data.flash.hasOwnProperty(type)) {
        var msgs = data.flash[type];
        for (var i = 0, len = msgs.length; i < len; i++) {
          flash[type](msgs[i]);
        }
      }
    }

    return resource.update(model);
  }

  return resource;
}

module.exports = session;
