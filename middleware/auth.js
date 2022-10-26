const debug = require('debug')('app:middleware:auth');

const jwt = require('jsonwebtoken');
const config = require('config');

const authSecret = config.get('auth.secret');

const auth = () =>{
    return (req, res, next) => {
        const authHeader = req.headers['Authorization'];
        const authCookie = req.cookies.authToken;

        if(authHeader) {
            const [authType, authToken] = authHeader.split(' ', 2);
            if(authType === 'Bearer' && authToken) {
                try {
                    req.auth = jwt.verify(authToken, authSecret);
                    
                } catch(err) {
                    debug('invalid auth token');
                }
            }
        }
        else if(authCookie) {
            try {
                req.auth = jwt.verify(authCookie, authSecret);
                const cookieOptions = {httpOnly: true, maxAge: parseInt(config.get('auth.cookieMaxAge'))};
                res.cookie('authToken', authCookie, cookieOptions);
            } catch(err) {
                debug('invalid auth cookie');
            }
        }
        next();
    };
};




module.exports = auth;