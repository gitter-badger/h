'use strict';

// @ngInject
function controller($http, session) {
  var vm = this;

  vm.showSidebarTutorial = function () {
    return session.state.show_sidebar_tutorial;
  };

  vm.dismiss = function () {
    $http({method: 'POST', url: '/sidebar_tutorial/dismiss'});
    session.dismissSidebarTutorial();
  };
}

/**
 * @ngdoc directive
 * @name sidebarTutorial
 * @description Displays a short tutorial in the sidebar.
 */
// @ngInject
module.exports = function () {
  return {
    bindToController: true,
    controller: controller,
    controllerAs: 'vm',
    restrict: 'E',
    scope: {},
    templateUrl: 'sidebar_tutorial.html'
  };
};
