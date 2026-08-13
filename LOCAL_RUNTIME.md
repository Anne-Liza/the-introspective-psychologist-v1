# Local Runtime

This generated app has its own local runtime ports.

- Frontend: http://localhost:5191
- Backend: http://localhost:8018
- API docs: http://localhost:8018/docs
- Health: http://localhost:8018/health
- PostgreSQL host port: 5455
- Mailpit UI: http://localhost:8043
- Mailpit SMTP host port: 1043

The backend CORS origin is limited to this app's own frontend URL.
The factory frontend port is not whitelisted in this client app.
