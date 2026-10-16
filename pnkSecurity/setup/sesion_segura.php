<?php

// VUL-02: Configuración segura de sesiones.

if (session_status() === PHP_SESSION_NONE) {

    $esHttps = !empty($_SERVER['HTTPS']) &&
               strtolower((string) $_SERVER['HTTPS']) !== 'off';

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $esHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    ini_set('session.use_strict_mode', '1');

    session_start();
}