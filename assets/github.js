angular.module('Github', ['ngResource'])
.factory('User', function($resource, $cookies) {
  var User = $resource(
    'https://api.github.com/user',
    {
      access_token: $cookies.token,
    }
  );
  return User;
})
.factory('Issue', function($resource, $cookies) {
  var Issue = $resource(
    'https://api.github.com/repos/:owner/:repo/issues',
    {
      owner: 'GForces-UK',
      repo: 'netdirector-auto',
      access_token: $cookies.token,
    }
  );
  Issue.prototype.hasDefaultEstimation = function() {
    return !this.body.match(/estimate(:?\s*)(\d+)h/i);
  }
  Issue.prototype.estimationTime = function() {
    var matches = this.body.match(/estimate(:?\s*)(\d+)h/i);
    return matches && matches[2] ? parseFloat(matches[2]) : 4;
  }
  return Issue;
})
.factory('Milestone', function($resource, $cookies) {
  var Milestone = $resource(
    'https://api.github.com/repos/:owner/:repo/milestones',
    {
      owner: 'GForces-UK',
      repo: 'netdirector-auto',
      access_token: $cookies.token
    }
  );
  Milestone.prototype.startedAt = function() {
    var timestamp;
    var matches = this.description.match(/started at(:?\s*)([\d\s-.\/]+)/i);
    var date = matches && matches[2] && isNaN(timestamp = Date.parse(matches[2])) == false && timestamp < new Date(this.due_on).getTime() ? new Date(timestamp) : new Date(this.created_at);
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    return date;
  }
  return Milestone;
  
});