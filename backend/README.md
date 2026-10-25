# FaceSecure Pay - Backend API

Backend API for FaceSecure Pay with fraud detection, face verification, and report management.

## Features

- ✅ Admin authentication with JWT
- ✅ Public fraud report submission
- ✅ Report status tracking by reference number
- ✅ Admin dashboard with real-time statistics
- ✅ User report management system
- 🚧 User authentication (coming soon)
- 🚧 Transaction processing (coming soon)
- 🚧 Face verification API (coming soon)

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   
   Edit `.env` file with your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=facesecure_pay
   DB_PORT=3306
   
   PORT=3000
   NODE_ENV=development
   
   JWT_SECRET=your_secret_key_change_this_in_production
   ```

3. **Setup database:**
   ```bash
   npm run setup
   ```
   
   This will:
   - Create the `facesecure_pay` database
   - Create all required tables
   - Insert a default admin account

4. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Default Admin Credentials

```
Username: admin
Password: admin123
Email: admin@facesecure.com
```

⚠️ **Important:** Change the default password after first login!

## API Endpoints

### Health Check
- `GET /health` - Check if API is running

### Admin Routes (`/api/admin`)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/stats` - Dashboard statistics (protected)
- `GET /api/admin/activity` - Recent activity (protected)

### Report Routes (`/api/reports`)
- `POST /api/reports/submit` - Submit fraud report (public)
- `GET /api/reports/status/:reference` - Check report status (public)
- `GET /api/reports/admin/all` - Get all reports (admin)
- `GET /api/reports/admin/stats` - Report statistics (admin)
- `PATCH /api/reports/admin/:id/status` - Update report status (admin)
- `PATCH /api/reports/admin/:id/assign` - Assign report to admin (admin)

## Database Schema

### Tables

1. **admins** - Admin accounts
2. **users** - Customer accounts
3. **transactions** - Payment transactions
4. **face_registrations** - Face enrollment data
5. **user_reports** - Fraud/issue reports submitted by public/users
6. **report_updates** - Status change history for reports

## Testing

Test the API health:
```bash
curl http://localhost:3000/health
```

Test admin login:
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Test report submission:
```bash
curl -X POST http://localhost:3000/api/reports/submit \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "fraud",
    "subject": "Test Report",
    "description": "This is a test fraud report for testing purposes",
    "reporterEmail": "test@example.com",
    "reporterName": "Test User"
  }'
```

## Security Features

- ✅ Helmet.js for HTTP headers security
- ✅ CORS protection
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ Input validation with express-validator

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `` |
| `DB_NAME` | Database name | `facesecure_pay` |
| `DB_PORT` | MySQL port | `3306` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | Token expiration | `24h` |
| `CORS_ORIGIN` | Allowed origins | `http://127.0.0.1:5500,http://localhost:5500` |
| `RATE_LIMIT_WINDOW` | Rate limit window (minutes) | `15` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

## Development

### Project Structure

```
backend/
├── config/
│   ├── database.js      # MySQL connection pool
│   └── schema.sql       # Database schema
├── middleware/
│   └── auth.js          # Authentication middleware
├── routes/
│   ├── admin.js         # Admin endpoints
│   └── reports.js       # Report endpoints
├── .env                 # Environment variables
├── server.js            # Main server file
├── setup-database.js    # Database setup script
└── package.json         # Dependencies
```

### Adding New Routes

1. Create route file in `routes/`
2. Import in `server.js`
3. Mount with `app.use('/api/path', require('./routes/file'))`

## Troubleshooting

### Database Connection Failed
- Check if MySQL is running: `mysql --version`
- Verify credentials in `.env`
- Ensure database user has CREATE DATABASE permission

### Port Already in Use
- Change `PORT` in `.env`
- Or kill the process using port 3000:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  
  # Linux/Mac
  lsof -i :3000
  kill -9 <PID>
  ```

### CORS Errors
- Add your frontend URL to `CORS_ORIGIN` in `.env`
- Separate multiple origins with commas

## Next Steps

- [ ] Implement user authentication
- [ ] Add transaction processing
- [ ] Integrate face verification API
- [ ] Add fraud detection logic
- [ ] Implement email notifications
- [ ] Add report file upload support
- [ ] Create admin dashboard analytics
- [ ] Add audit logging

## License

ISC
