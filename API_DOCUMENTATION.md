# API Documentation

## GET /users

Returns all users.

## POST /users

Request:

{
  "employee_id": "EMP001",
  "name": "Rithwick",
  "email": "rithwick@example.com",
  "department": "IT",
  "role": "Employee"
}

Response:

{
  "message": "User Created",
  "id": 1
}