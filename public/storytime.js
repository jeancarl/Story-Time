angular.module('storyTimeApp', [])
.controller('storyTimeCtrl', function($scope) {
  $scope.att = {
    myDHS: 'http://0.0.0.0:9000',
    ewebrtcDomain: '',
    appTokenUrl: '',
    accessToken: {},
    phone: ATT.rtc.Phone.getPhone()
  };
  $scope.status = {
    isLoggedIn: false,
    isIncomingCall: false,
    isConnected: false,
    isOnHold: false,
    isMuted: false
  };
  $scope.socket = io();
  $scope.statusLabel = '';
  $scope.username = '';
  $scope.callTo = '';
  $scope.room = '';
  $scope.page = 0;

  $scope.onConfig = function(data) {
    $scope.$apply(function() {
      $scope.att.ewebrtcDomain = data.ewebrtc_domain;
      $scope.att.appTokenUrl = data.app_token_url;
      console.log($scope.att);
    });
  }

  // Get the domain app token URL
  $.ajax({    
    type: 'GET',
    url: $scope.att.myDHS + '/config',
    success: $scope.onConfig,
    error: $scope.onError   
  });

  $scope.onError = function(data) {
    console.log('onError');
    $scope.$apply(function() {
      $scope.statusLabel = 'Error: ' + data.error.ErrorMessage;
    });
  }

  $scope.onLogin = function(data) {
    $scope.$apply(function() {
      $scope.att.accessToken = data;
      $scope.associateAccessToken();
    });
  }

  $scope.login = function() {
    // Obtain access token

    $.ajax({    
        type: 'POST',
        url: $scope.att.appTokenUrl, 
        data: {app_scope: 'ACCOUNT_ID'},
        success: $scope.onLogin,
        error: $scope.onError
    });   
  }

  $scope.onAssociateAccessToken = function() {
    $scope.att.phone.login({token: $scope.att.accessToken.access_token});
  }

  $scope.onLoginSuccess = function(data) {
    $scope.$apply(function() {
      $scope.statusLabel = 'Login successful';
      $scope.status.isLoggedIn = true;
      console.log(data);
    });
  }

  $scope.associateAccessToken = function() {
    $scope.att.phone.associateAccessToken({
      userId: $scope.username,
      token: $scope.att.accessToken.access_token,
      success: $scope.onAssociateAccessToken,
      error: $scope.onError
    }); 
  }

  $scope.onLogout = function() {
    $scope.$apply(function() {
      $scope.statusLabel = 'Logged out';
      $scope.status.isLoggedIn = false;
    });
  }

  $scope.logout = function() {
    $scope.att.phone.logout();
  }

  $scope.makeCall = function() {
    $scope.statusLabel = 'Calling '+$scope.callTo;

    $scope.att.phone.dial({
      destination: $scope.att.phone.cleanPhoneNumber($scope.callTo),
      mediaType: 'video',
      localMedia: document.getElementById('localVideo'),
      remoteMedia: document.getElementById('remoteVideo')
    });
  }

  $scope.endCall = function() {
    $scope.att.phone.hangup();
  }

  $scope.onCallConnected = function(data) {
    $scope.$apply(function() {
      $scope.status.isIncomingCall = false;
      $scope.room = (data.hasOwnProperty('to')) ? 
        'sip:'+$scope.username+'@'+$scope.att.ewebrtcDomain+':sip:'+data.to :
        data.from+':sip:'+$scope.username+'@'+$scope.att.ewebrtcDomain;   
      
      console.log('room:'+$scope.room);
      $scope.socket.emit('join', $scope.room);


      console.log(data);
      $scope.statusLabel = 'Call connected with ' + (data.from || data.to);
      $scope.status.isConnected = true;
    });
  }

  $scope.onCallDisconnected = function(data) {
    $scope.$apply(function() {
      $scope.statusLabel = 'Call disconnected';
      $scope.status.isConnected = false;
      $scope.status.isIncomingCall = false;

      console.log('leaving room:'+$scope.room);
      
      $scope.socket.emit('leave', $scope.room);
      $scope.room = '';
    });
  }

  $scope.answerCall = function() {
    $scope.att.phone.answer({
      mediaType: 'video',
      localMedia: document.getElementById('localVideo'),
      remoteMedia: document.getElementById('remoteVideo')
    });  
  }

  $scope.onIncomingCall = function(data) {
    $scope.$apply(function() {
      $scope.status.isIncomingCall = true;
      $scope.statusLabel = 'Incoming call from ' + data.from;
    });
  }

  $scope.holdCall = function() {
    $scope.att.phone.hold();
  }
      
  $scope.resumeCall = function() {
    $scope.att.phone.resume();
  } 

  $scope.onHeldCall = function() {
    $scope.$apply(function() {
      $scope.statusLabel = 'Call on hold';
      $scope.status.isOnHold = true;
    });
  }        

  $scope.onResumedCall = function() {
    $scope.$apply(function() {
      $scope.statusLabel = 'Call resumed';
      $scope.status.isOnHold = false;
    });
  } 

  $scope.muteCall = function() {
      $scope.att.phone.mute();
  }
      
  $scope.unmuteCall = function() {
      $scope.att.phone.unmute();
  }  

  $scope.onMutedCall = function() {
    $scope.$apply(function() {
      $scope.statusLabel = 'Call muted';
      $scope.status.isMuted = true;
    });
  }        

  $scope.onUnmutedCall = function() {
    $scope.$apply(function() {
      $scope.statusLabel = 'Call unmuted';
      $scope.status.isMuted = false;
    });
  } 

  $scope.nextPage = function() {
    $scope.page++;
    $scope.statusLabel = 'Changing to page '+$scope.page;    
    $scope.socket.emit('update', {room: $scope.room, event: 'page:changed', page: $scope.page});
  }

  $scope.previousPage = function() {
    $scope.page--;
    $scope.statusLabel = 'Changing to page '+$scope.page;    
    $scope.socket.emit('update', {room: $scope.room, event: 'page:changed', page: $scope.page});
  }

  $scope.att.phone.on('error', $scope.onError);  
  $scope.att.phone.on('session:ready', $scope.onLoginSuccess);
  $scope.att.phone.on('session:disconnected', $scope.onLogout);  
  $scope.att.phone.on('call:connected', $scope.onCallConnected);
  $scope.att.phone.on('call:disconnected', $scope.onCallDisconnected);
  $scope.att.phone.on('call:incoming', $scope.onIncomingCall);
  $scope.att.phone.on('call:held', $scope.onHeldCall);
  $scope.att.phone.on('call:resumed', $scope.onResumedCall);
  $scope.att.phone.on('call:muted', $scope.onMutedCall);
  $scope.att.phone.on('call:unmuted', $scope.onUnmutedCall);

  $scope.socket.on('page:changed', function(data) {
    console.log(data);
    $scope.$apply(function() {
      $scope.statusLabel = 'Changing to page '+data.page;
      $scope.page = data.page;
    });
  });
});
