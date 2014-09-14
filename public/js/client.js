/* HTML5 magic
- GeoLocation
- WebSpeech
*/

//WebSpeech API
var final_transcript = '';
var recognizing = false;
var last10messages = []; //to be populated later

if (!('webkitSpeechRecognition' in window)) {
  console.log("webkitSpeechRecognition is not available");
} else {
  var recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    recognizing = true;
  };

  recognition.onresult = function(event) {
    var interim_transcript = '';
    for (var i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript;
        $('#msg').addClass("final");
        $('#msg').removeClass("interim");
      } else {
        interim_transcript += event.results[i][0].transcript;
        $("#msg").val(interim_transcript);
        $('#msg').addClass("interim");
        $('#msg').removeClass("final");
      }
    }
    $("#msg").val(final_transcript);
    };
  }

  function startButton(event) {
    if (recognizing) {
      recognition.stop();
      recognizing = false;
      $("#start_button").prop("value", "Record");
      return;
    }
    final_transcript = '';
    recognition.lang = "en-GB"
    recognition.start();
    $("#start_button").prop("value", "Recording ... Click to stop.");
    $("#msg").val();
  }
//end of WebSpeech

/*
Functions
*/
function toggleNameForm() {
   $("#login-screen").toggle();
}

function toggleChatWindow() {
  $("#main-chat-screen").toggle();
}

$(document).ready(function() {
  //setup "global" variables first
  var socket = io.connect("127.0.0.1:3000");
  var myRoomID = null;

  $("form").submit(function(event) {
    event.preventDefault();
  });

  $("#conversation").bind("DOMSubtreeModified",function() {
    $("#conversation").animate({
        scrollTop: $("#conversation")[0].scrollHeight
      });
  });

  $("#main-chat-screen").hide();
  $("#errors").hide();
  $("#name").focus();

  $("#join").attr('disabled', 'disabled'); 
  
  if ($("#name").val() === "" && $('#symptoms').val() === "") {
    $("#join").attr('disabled', 'disabled');
  }

  //enter screen
  $("#nameForm").submit(function() {
    var name = $("#name").val();
    var symptoms = $('#symptoms').val();
    var device = "desktop";
    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
      device = "mobile";
    }
    if (name === "" || name.length < 2) {
      $("#errors").empty();
      $("#errors").append("Please enter a name");
      $("#errors").show();
    } else if (symptoms === "" || symptoms.length < 10) {
      $("#errors").empty();
      $("#errors").append("Please enter your symptoms");
      $("#errors").show();		
	} else {
      socket.emit("joinserver", name, symptoms, device);
      toggleNameForm();
      toggleChatWindow();
      $("#msg").focus();
    }
  });

    

  $("#name").keypress(function(e){
    var name = $("#name").val();
    if(name.length < 2) {
      $("#join").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#join").removeAttr('disabled');
    }
  });
  
  $("#symptoms").keypress(function(e){
    var symptoms = $("#symptoms").val();
    if(symptoms.length < 10) {
      $("#join").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#join").removeAttr('disabled');
    }
  });

  if ($("#drs").val() === "" && $('#speciality').val() === "") {
    $("#drjoin").attr('disabled', 'disabled');
  }
  
  $("#doctorForm").submit(function() {
    var drs = $("#drs").val();
    var speciality = $('#speciality').val();
    var device = "desktop";
    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
      device = "mobile";
    }
    if (drs === "" || drs.length < 2) {
      $("#errors").empty();
      $("#errors").append("Please enter a name");
      $("#errors").show();
    } else if (speciality === "" || speciality.length < 10) {
      $("#errors").empty();
      $("#errors").append("Please enter your speciality");
      $("#errors").show();		
	} else {
      socket.emit("doctorjoinserver", drs, speciality, device);
      toggleNameForm();
      toggleChatWindow();
      $("#msg").focus();
    }
  });
  
 $("#drs").keypress(function(e){
    var drs = $("#drs").val();
    if(drs.length < 2) {
      $("#drjoin").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#drjoin").removeAttr('disabled');
    }
  });
  
  $("#speciality").keypress(function(e){
    var speciality = $("#speciality").val();
    if(speciality.length < 10) {
      $("#drjoin").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#drjoin").removeAttr('disabled');
    }
  });
  
  

  //main chat screen
  $("#chatForm").submit(function() {
    var msg = $("#msg").val();
    if (msg !== "") {
      socket.emit("send", msg);
      $("#msg").val("");
    }
  });

  //'is typing' message
  var typing = false;
  var timeout = undefined;

  function timeoutFunction() {
    typing = false;
    socket.emit("typing", false);
  }

  $("#msg").keypress(function(e){
    if (e.which !== 13) {
      if (typing === false && myRoomID !== null && $("#msg").is(":focus")) {
        typing = true;
        socket.emit("typing", true);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 5000);
      }
    }
  });

  socket.on("isTyping", function(data) {
    if (data.isTyping) {
      if ($("#"+data.person+"").length === 0) {
        $("#updates").append("<li id='"+ data.person +"'><span class='text-muted'><small><i class='fa fa-keyboard-o'></i> " + data.person + " is typing.</small></li>");
        timeout = setTimeout(timeoutFunction, 5000);
      }
    } else {
      $("#"+data.person+"").remove();
    }
  });


/*
  $("#msg").keypress(function(){
    if ($("#msg").is(":focus")) {
      if (myRoomID !== null) {
        socket.emit("isTyping");
      }
    } else {
      $("#keyboard").remove();
    }
  });

  socket.on("isTyping", function(data) {
    if (data.typing) {
      if ($("#keyboard").length === 0)
        $("#updates").append("<li id='keyboard'><span class='text-muted'><i class='fa fa-keyboard-o'></i>" + data.person + " is typing.</li>");
    } else {
      socket.emit("clearMessage");
      $("#keyboard").remove();
    }
    console.log(data);
  });
*/

  $("#showCreateRoom").click(function() {
    $("#createRoomForm").toggle();
  });

  $("#createRoomBtn").click(function() {
    var roomExists = false;
    var roomName = $("#createRoomName").val();
    socket.emit("check", roomName, function(data) {
      roomExists = data.result;
       if (roomExists) {
          $("#errors").empty();
          $("#errors").show();
          $("#errors").append("Room <i>" + roomName + "</i> already exists");
        } else {      
        if (roomName.length > 0) { //also check for roomname
          socket.emit("createRoom", roomName);
          $("#errors").empty();
          $("#errors").hide();
          }
        }
    });
  });

  $("#rooms").on('click', '.joinRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("joinRoom", roomID);
  });

  $("#rooms").on('click', '.removeRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("removeRoom", roomID);
    $("#createRoom").show();
  }); 

  $("#leave").click(function() {
    var roomID = myRoomID;
    socket.emit("leaveRoom", roomID);
    $("#createRoom").show();
  });

  $("#people").on('click', '.whisper', function() {
    var name = $(this).siblings("span").text();
    $("#msg").val("w:"+name+":");
    $("#msg").focus();
  });
  
  $("#doctors").on('click', '.whisper', function() {
    var name = $(this).siblings("span").text();
    $("#msg").val("w:"+drs+":");
    $("#msg").focus();
  });



//socket-y stuff
socket.on("exists", function(data) {
  $("#errors").empty();
  $("#errors").show();
  $("#errors").append(data.msg + " Try <strong>" + data.proposedName + "</strong>");
    toggleNameForm();
    toggleChatWindow();
});

socket.on("history", function(data) {
  if (data.length !== 0) {
    $("#msgs").append("<li><strong><span class='text-warning'>Last 10 messages:</li>");
    $.each(data, function(data, msg) {
      $("#msgs").append("<li><span class='text-warning'>" + msg + "</span></li>");
    });
  } else {
    $("#msgs").append("<li><strong><span class='text-warning'>No past messages in this room.</li>");
  }
});

  socket.on("update", function(msg) {
    $("#msgs").append("<li>" + msg + "</li>");
  });

  socket.on("update-people", function(data){
    $("#people").empty();
    $('#people').append("<li class=\"list-group-item active\">People online <span class=\"badge\">"+data.count+"</span></li>");
    $.each(data.people, function(a, obj) {

      $('#people').append("<li class=\"list-group-item\"><span>" + obj.name + "</span> <i class=\"fa fa-"+obj.device+"\"></i>  <br/> " + obj.symptoms + "<br/><a href=\"#\" class=\"whisper btn btn-xs\">whisper</a></li>");

    });
  });
    
  socket.on("update-doctors", function(data){
    $("#doctors").empty();
    $("#doctors").append("<li class=\"list-group-item active\">Doctors online <span class=\"badge\">"+data.count+"</span></li>");
    $.each(data.doctors, function(a, obj) {
      $('#doctors').append("<li class=\"list-group-item\"><span>" + obj.drs + "</span> <i class=\"fa fa-"+obj.device+"\"></i> <br/> " + obj.speciality + "<br/><a href=\"#\" class=\"whisper btn btn-xs\">whisper</a></li>");

    });
  });

  socket.on("chat", function(person, msg) {
    $("#msgs").append("<li><strong><span class='text-success'>" + person.name + "</span></strong>: " + msg + "</li>");
    //clear typing field
     $("#"+person.name+"").remove();
     clearTimeout(timeout);
     timeout = setTimeout(timeoutFunction, 0);
  });

  socket.on("whisper", function(person, msg) {
    if (person.name === "You") {
      s = "whisper"
    } else {
      s = "whispers"
    }
    $("#msgs").append("<li><strong><span class='text-muted'>" + person.name + "</span></strong> "+s+": " + msg + "</li>");
  });

  socket.on("roomList", function(data) {
    $("#rooms").text("");
    $("#rooms").append("<li class=\"list-group-item active\">List of rooms <span class=\"badge\">"+data.count+"</span></li>");
     if (!jQuery.isEmptyObject(data.rooms)) { 
      $.each(data.rooms, function(id, room) {
        var html = "<button id="+id+" class='joinRoomBtn btn btn-default btn-xs' >Join</button>" + " " + "<button id="+id+" class='removeRoomBtn btn btn-default btn-xs'>Remove</button>";
        $('#rooms').append("<li id="+id+" class=\"list-group-item\"><span>" + room.name + "</span> " + html + "</li>");
      });
    } else {
      $("#rooms").append("<li class=\"list-group-item\">There are no rooms yet.</li>");
    }
  });

  socket.on("sendRoomID", function(data) {
    myRoomID = data.id;
  });

  socket.on("disconnect", function(){
    $("#msgs").append("<li><strong><span class='text-warning'>The server is not available</span></strong></li>");
    $("#msg").attr("disabled", "disabled");
    $("#send").attr("disabled", "disabled");
  });

});
