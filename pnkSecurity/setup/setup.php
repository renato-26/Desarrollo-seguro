<?php

// VUL-05: Evitar la divulgación de información interna mediante errores.
error_reporting(E_ALL);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');

set_exception_handler(function (Throwable $e) {
    // Registrar únicamente información técnica mínima en el log interno.
    error_log(
        '[pnkSecurity] Excepcion no controlada: ' .
        get_class($e) .
        ' en ' .
        basename($e->getFile()) .
        ':' .
        $e->getLine()
    );

    if (!headers_sent()) {
        http_response_code(500);
    }

    exit('Ocurrió un error interno. Intente nuevamente más tarde.');
});

function conectar()
{
    $con=mysqli_connect("localhost","root","","pnk_security");
    return $con;
}

function quitarespacios($titulo)
{
    $titulo =str_replace(" ", "", $titulo);
    $cadena =str_replace("ñ", "", $titulo);
    $cadena =str_replace("Ñ", "", $cadena);
    return $cadena;
}

function moneda_chilena($numero){
    $numero = (string)$numero;
    $puntos = floor((strlen($numero)-1)/3);
    $tmp = "";
    $pos = 1;
    for($i=strlen($numero)-1; $i>=0; $i--){
    $tmp = $tmp.substr($numero, $i, 1);
    if($pos%3==0 && $pos!=strlen($numero))
    $tmp = $tmp.".";
    $pos = $pos + 1;
    }
    $formateado = "$ ".strrev($tmp);
    return $formateado;
    }

?>