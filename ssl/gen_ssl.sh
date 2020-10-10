#!/bin/bash
openssl genrsa -out ssl/key.pem && MSYS_NO_PATHCONV=1 openssl req -new -key ssl/key.pem -out ssl/csr.pem -subj "/C=US/ST=Ljubljana/L=Ljubljana/O=Security/OU=IT Department/CN=localhost"
openssl x509 -req -days 9999 -in ssl/csr.pem -signkey ssl/key.pem -out ssl/cert.pem && rm ssl/csr.pem 