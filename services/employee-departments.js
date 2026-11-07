'use strict';
// Canonical workforce departments. Existing database records are not rewritten:
// an unapproved historical label must be reviewed before reassignment.
const DEPARTMENTS=Object.freeze([
 'Engineering',
 'Marketing',
 'Human Resources',
 'Finance',
 'Customer Support',
 'Sales & Business Development'
]);
const lookup=new Map(DEPARTMENTS.map(department=>[department.toLowerCase(),department]));
function canonicalDepartment(value){
 return typeof value==='string'?lookup.get(value.trim().toLowerCase())||null:null;
}
module.exports={DEPARTMENTS,canonicalDepartment};
