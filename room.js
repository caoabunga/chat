function Room(name, id, owner) {
  this.name = name;
  this.id = id;
  this.owner = owner;
  this.people = [];
  this.doctors = [];
  this.peopleLimit = 4;
  this.status = "available";
  this.private = false;
};

Room.prototype.addPerson = function(personID) {
  if (this.status === "available") {
    this.people.push(personID);
  }
};

Room.prototype.addDoctor = function(doctorID) {
  if (this.status === "available") {
    this.doctors.push(doctorID);
  }
};

Room.prototype.removePerson = function(person) {
  var personIndex = -1;
  for(var i = 0; i < this.people.length; i++){
    if(this.people[i].id === person.id){
      personIndex = i;
      break;
    }
  }
  this.people.remove(personIndex);
};

Room.prototype.getPerson = function(personID) {
  var person = null;
  for(var i = 0; i < this.people.length; i++) {
    if(this.people[i].id == personID) {
      person = this.people[i];
      break;
    }
  }
  return person;
};

Room.prototype.removeDoctor = function(doctor) {
  var doctorIndex = -1;
  for(var i = 0; i < this.doctors.length; i++){
    if(this.doctors[i].id === doctor.id){
      doctorIndex = i;
      break;
    }
  }
  this.doctors.remove(doctorIndex);
};

Room.prototype.getDoctor = function(doctorID) {
  var doctor = null;
  for(var i = 0; i < this.doctors.length; i++) {
    if(this.doctors[i].id == doctorID) {
      doctor = this.doctors[i];
      break;
    }
  }
  return doctor;
};

Room.prototype.isAvailable = function() {
  if (this.available === "available") {
    return true;
  } else {
    return false;
  }
};

Room.prototype.isPrivate = function() {
  if (this.private) {
    return true;
  } else {
    return false;
  }
};

module.exports = Room;
