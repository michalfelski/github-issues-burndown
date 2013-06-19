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
  var maxDate;
  var maxHours = 0;
  var dueDate;
  Milestone.query({per_page: 1, page: 1, repo: repo}, function(milestones) {
    var currentMilestone = $scope.milestone = milestones[0];
    maxDate = dueDate = (new Date(currentMilestone.due_on)).dateOnly();
    
    Issue.query({milestone: currentMilestone.number, per_page: 1000, state: 'closed', repo: repo}, function(issues) {
      $(issues).each(function(index, issue) {
        var closedDate = (new Date(issue.closed_at)).dateOnly();
        var key = closedDate.getTime();
        hours[key] = (hours[key] || 0) + issue.estimationTime();
        tickets[key] = (tickets[key] || 0) + 1;
        if (closedDate.getTime() > maxDate.getTime()) maxDate = closedDate;
        maxHours += issue.estimationTime();
      });
      
      $scope.openIssues = Issue.query({milestone: currentMilestone.number, per_page: 1000, state: 'open', repo: repo}, function(issues) {
        $(issues).each(function(index, issue) {
          maxHours += issue.estimationTime();
        });
        
        var currentTimestamp = (new Date(currentMilestone.created_at)).dateOnly().getTime();
        var startDate = currentMilestone.startedAt();
        var now = (new Date()).dateOnly().getTime();
        var plannedDailyHours = maxHours * 24 * 3600 * 1000 / (dueDate.getTime() - startDate.getTime());
        
        var data = new google.visualization.DataTable();
        data.addColumn('date', 'Time');
        data.addColumn('number', 'Planned');
        data.addColumn('number', 'Closed');
        data.addColumn('number', 'Remaining');
        var remaining = remainingPlanned = maxHours;
        var closed;
        while (currentTimestamp <= maxDate.getTime()) {
          if (currentTimestamp <= now) {
            closed = hours[currentTimestamp] || 0;
            remaining -= closed;
          } else {
            closed = null;
            remaining = null;
          }
          if (currentTimestamp >= startDate.getTime()) {
            planned = remainingPlanned > -0.5 ? Number(remainingPlanned.toFixed(3)) : null;
            remainingPlanned -= plannedDailyHours;
          } else {
            planned = null;
          }
          data.addRow([new Date(currentTimestamp), {v: planned, f: ''}, {v: closed, f: closed + ' hours (' + tickets[currentTimestamp] + ' issues)'}, {v: remaining, f: remaining + ' hours'}]);
          currentTimestamp += 24 * 3600 * 1000;
        }
        var options = {
          animation: {
            duration: 10000
          },
          pointSize: 3,
          title : currentMilestone.title,
          vAxis: {
            title: "Hours",
          },
          hAxis: {
            format: 'MMM d',
            gridlines: {
              count: 6
            }
            //minValue: new Date(currentMilestone.created_at),
            //maxValue: maxDate
          },
          legend: {
            position: 'none'
          },
          series: {
            0: {
              type: 'line',
              color: '#ccc',
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
        /*
        $('.' + repo + ' .graph').highcharts({
          credits: {
            enabled: false
          },
          title: {
            text: currentMilestone.title
          },
          xAxis: {
            type: 'datetime',
            showLastLabel: true,
            tickPosition: 'inside',
            tickmarkPlacement: 'on'
          },
          yAxis: {
            title: {
              text: 'Hours'
            }
          },
          series: [
            {
              pointInterval: 24 * 3600 * 1000,
              pointStart: (new Date(currentMilestone.created_at)).getTime(),
              type: 'column',
              name: 'closed',
              data: closed
            }, {
              pointInterval: 24 * 3600 * 1000,
              pointStart: (new Date(currentMilestone.created_at)).getTime(),
              type: 'line',
              name: 'Plan',
              data: plan,
              color: '#ccc',
              marker: {
                enabled: false
              }
            }, {
              pointInterval: 24 * 3600 * 1000,
              pointStart: (new Date(currentMilestone.created_at)).getTime(),
              type: 'spline',
              name: 'Remaining',
              data: remaining,
              color: 'black',
              marker: {
              	lineWidth: 2,
              	lineColor: Highcharts.getOptions().colors[3],
                radius: 2,
              	fillColor: 'white',
                symbol: 'circle'
              }
            }]
        });
        */
      });
    });
  });
}