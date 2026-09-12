export function authenticateUser(username: string, password: string) {
    // HARDCODED SECRETS FOR TESTING CODEWARD GUARDIAN
    const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
    const AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    const DB_PASSWORD = "super_secret_admin_password_123!";

    // SQL INJECTION VULNERABILITY
    const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
    
    console.log("Executing query:", query);
    console.log("Using AWS key:", AWS_ACCESS_KEY_ID);

    return true;
}
