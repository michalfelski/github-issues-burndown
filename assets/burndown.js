var app = angular.module('Burndown', ['ngCookies', 'GitHub']);

app.config(['$httpProvider', function ($httpProvider) {
  $httpProvider.defaults.headers.common['Authorization'] = 'application/json, text/plain';
}]);
app.config(function($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true);
  $routeProvider
    .when('/', {
      controller: MainCtrl, 
      templateUrl: '/views/dashboard.html'
    })
    .when('/:owner/:repo/:milestone', {
      controller: ShowCtrl, 
      templateUrl: '/views/show.html'
    })
    .otherwise({
      redirectTo: '/'
    });
});
app.run(function($cookies, $http, $rootScope, User, Organization, UserRepository, OrganizationRepository, Milestone){
  if (!$cookies.token) {
    window.location.href = '/auth.php';
  }
  $rootScope.user = User.get();
  $rootScope.repositories = {};
  UserRepository.query({}, function(repos) {
    $(repos).each(function(index, repo) {
      Milestone.query({owner: repo.owner.login, repo: repo.name}, function(milestones) {
        $(milestones).each(function(index,milestone) {
          $rootScope.repositories[repo.owner.login] = $rootScope.repositories[repo.owner.login] || {};
          $rootScope.repositories[repo.owner.login][repo.name] = $rootScope.repositories[repo.owner.login][repo.name] || {};
          $rootScope.repositories[repo.owner.login][repo.name][milestone.number] = milestone.title;
        })
      });
    });
  })
  Organization.query({}, function(orgs) {
    $(orgs).each(function(index, org) {
      OrganizationRepository.query({org: org.login}, function(repos) {
        $rootScope.repositories[org.login] = {};
        $(repos).each(function(index, repo) {
          Milestone.query({owner: org.login, repo: repo.name}, function(milestones) {
            $(milestones).each(function(index,milestone) {
              $rootScope.repositories[org.login][repo.name] = $rootScope.repositories[org.login][repo.name] || {};
              $rootScope.repositories[org.login][repo.name][milestone.number] = milestone.title;
            })
          });
        });
      });
    });
  });
});

Date.prototype.dateOnly = function() {
  this.setHours(0);
  this.setMinutes(0);
  this.setSeconds(0);
  return this;
}

function MainCtrl($scope, Issue, Milestone) {
  var itemsPerRow = 3;
  $scope.graphs = [[]];
  $(JSON.parse($.cookie('graphs'))).each(function(index, graph){
    var owner = graph.split('/')[0];
    var repo = graph.split('/')[1];
    var number = graph.split('/')[2];
    var graph = {
      milestone: Milestone.get({owner: owner, repo: repo, number: number}),
      repo: repo,
      owner: owner
    }
    if ($scope.graphs[$scope.graphs.length - 1].length == itemsPerRow) $scope.graphs.push([]);
    $scope.graphs[$scope.graphs.length - 1].push(graph);
    setTimeout(function() {
      app.graph(document.getElementById('graph-' + index), graph, $scope, Issue);
    }, 1000)
  });
}

function ShowCtrl($scope, $routeParams, Issue, Milestone) {
  $scope.owner = $routeParams.owner;
  var key = $routeParams.owner + '/' + $routeParams.repo + '/' + $routeParams.milestone;
  var graphs = ($.cookie("graphs") && JSON.parse($.cookie("graphs"))) || [];
  $scope.onDashboard = graphs.indexOf(key) > -1;
  $scope.toggleDashboard = function(){
    $scope.onDashboard = !$scope.onDashboard;
    $scope.onDashboard ? graphs.push(key) : graphs.splice(graphs.indexOf(key), 1);
    $.cookie("graphs", JSON.stringify(graphs), {path: '/', expires: 180});
  };
  Milestone.get({owner: $routeParams.owner, repo: $routeParams.repo, number: $routeParams.milestone}, function(m) {
    var graph = {
      milestone: m,
      repo: $routeParams.repo,
      owner: $routeParams.owner
    }
    $scope.graph = graph;
    app.graph(document.getElementById('graph'), graph, $scope, Issue);
  });
}

app.graph = function(element, graph, $scope, Issue) {
  var hours = {};
  var tickets = {};
  var maxHours = 0;
  var dueDate;
  var maxDate = (new Date(graph.milestone.due_on)).dateOnly();
  var dueDate = (new Date(graph.milestone.due_on)).dateOnly();
  var minDate = graph.milestone.startedAt();
  var startDate = graph.milestone.startedAt();
  Issue.query({milestone: graph.milestone.number, per_page: 1000, state: 'closed', repo: graph.repo}, function(issues) {
    $(issues).each(function(index, issue) {
      var closedDate = (new Date(issue.closed_at)).dateOnly();
      var key = closedDate.getTime();
      hours[key] = (hours[key] || 0) + issue.estimationTime();
      tickets[key] = (tickets[key] || 0) + 1;
      if (closedDate.getTime() > maxDate.getTime()) maxDate = closedDate;
      if (closedDate.getTime() < minDate.getTime()) minDate = new Date(closedDate.getTime() - 24 * 3600 * 1000);;
      maxHours += issue.estimationTime();
    });
    
    $scope.openIssues = Issue.query({milestone: graph.milestone.number, per_page: 1000, state: 'open', repo: graph.repo}, function(issues) {
      $(issues).each(function(index, issue) {
        maxHours += issue.estimationTime();
      });
      
      var workDays = 0;
      var currentDate = new Date(startDate.getTime() + 24 * 3600 * 1000);
      
      while (currentDate.getTime() <= dueDate.getTime()) {
        if (currentDate.getDay() != 0 && currentDate.getDay() != 6) workDays += 1;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      var plannedDailyHours = maxHours / workDays;
      
      var data = new google.visualization.DataTable();
      data.addColumn('date', 'Time');
      data.addColumn('number', 'Planned');
      data.addColumn('number', 'Closed');
      data.addColumn('number', 'Remaining');
      var remaining = remainingPlanned = maxHours;
      var closed;
      var currentTimestamp = minDate.getTime();
      var now = (new Date()).dateOnly().getTime();
      while (currentTimestamp <= maxDate.getTime()) {
        if (currentTimestamp <= now) {
          closed = hours[currentTimestamp] || 0;
          remaining -= closed;
        } else {
          closed = null;
          remaining = null;
        }
        if (currentTimestamp >= startDate.getTime() && currentTimestamp <= dueDate.getTime()) {
          if (currentTimestamp != startDate.getTime() && (new Date(currentTimestamp).getDay() != 0) && (new Date(currentTimestamp).getDay() != 6)) remainingPlanned -= plannedDailyHours;
          planned = Math.round(remainingPlanned * 100) / 100;
        } else {
          planned = null;
        }
        data.addRow([new Date(currentTimestamp), {v: planned, f: Math.round(planned) + ' hours'}, {v: closed, f: closed + ' hours (' + tickets[currentTimestamp] + ' issues)'}, {v: remaining, f: remaining + ' hours'}]);
        currentTimestamp += 24 * 3600 * 1000;
      }
      var options = {
        animation: {
          duration: 10000
        },
        chartArea: {
          left: '5%',
          top: 6,
          width: '90%',
          height: '85%',
        },
        pointSize: 3,
        title : graph.milestone.title,
        vAxis: {
          title: "Hours"
        },
        hAxis: {
          format: 'MMM d'
        },
        legend: {
          position: 'none'
        },
        series: {
          0: {
            type: 'line',
            color: '#666',
            pointSize: 0,
            lineWidth: 1
          },
          1: {
            type: 'bars'
          },
          2: {
            type: 'line',
            color: '#3E78FD'
          }
        }
      };

      var chart = new google.visualization.ComboChart(element);
      chart.draw(data, options);
    });
  });
}