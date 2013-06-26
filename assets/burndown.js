var app = angular.module('Burndown', ['ngCookies', 'Github']);

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
    .when('/:repo', {
      controller: MainCtrl, 
      templateUrl: '/views/show.html'
    })
    .otherwise({
      redirectTo: '/'
    });
});
app.run(function($cookies, $http, $rootScope, User){
  if (!$cookies.token) {
    window.location.href = '/auth.php';
  }
  $rootScope.user = User.get();
});

Date.prototype.dateOnly = function() {
  this.setHours(0);
  this.setMinutes(0);
  this.setSeconds(0);
  return this;
}
  
function MainCtrl($scope, $routeParams, Issue, Milestone) {
  if ($routeParams.repo) $scope.repo = $routeParams.repo;
  if (!$scope.repo) return;
  var repo = $scope.repo;
  var hours = {};
  var tickets = {};
  var maxHours = 0;
  var dueDate;
  Milestone.query({per_page: 1, page: 1, repo: repo}, function(milestones) {
    var currentMilestone = $scope.milestone = milestones[0];
    var maxDate = (new Date(currentMilestone.due_on)).dateOnly();
    var dueDate = (new Date(currentMilestone.due_on)).dateOnly();
    var minDate = currentMilestone.startedAt();
    var startDate = currentMilestone.startedAt();
    
    Issue.query({milestone: currentMilestone.number, per_page: 1000, state: 'closed', repo: repo}, function(issues) {
      $(issues).each(function(index, issue) {
        var closedDate = (new Date(issue.closed_at)).dateOnly();
        var key = closedDate.getTime();
        hours[key] = (hours[key] || 0) + issue.estimationTime();
        tickets[key] = (tickets[key] || 0) + 1;
        if (closedDate.getTime() > maxDate.getTime()) maxDate = closedDate;
        if (closedDate.getTime() < minDate.getTime()) minDate = new Date(closedDate.getTime() - 24 * 3600 * 1000);;
        maxHours += issue.estimationTime();
      });
      
      $scope.openIssues = Issue.query({milestone: currentMilestone.number, per_page: 1000, state: 'open', repo: repo}, function(issues) {
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
          title : currentMilestone.title,
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

        var chart = new google.visualization.ComboChart($('.' + repo + ' .graph').get(0));
        chart.draw(data, options);
      });
    });
  });
}