# VUL-01 — Divulgación de versiones y tecnologías mediante cabeceras HTTP

**Responsable:** Renato Muñoz  
**Severidad:** Baja  
**Categoría:** A02:2025 Security Misconfiguration  
**Estado:** Mitigación verificada en WAMP local.

## 1. Descripción de la vulnerabilidad

La aplicación pnkSecurity exponía las versiones exactas de Apache, PHP y mod_fcgid mediante las cabeceras HTTP `Server` y `X-Powered-By`, facilitando el reconocimiento tecnológico del servidor.

## 2. Configuración vulnerable

**Apache — httpd.conf**

```
ServerSignature On
ServerTokens Full
```

**PHP — php.ini**

```
expose_php = On
```

## 3. Configuración corregida

**Apache — httpd.conf**

```
ServerSignature Off
ServerTokens Prod
```

**PHP — php.ini**

```
expose_php = Off
```

En WAMP se modificaron los archivos activos de Apache y PHP y se reiniciaron los servicios.

## 4. Verificación de seguridad

Se ejecutó la siguiente prueba:

```
curl.exe -I "http://localhost/Desarrollo-seguro/pnkSecurity/index.php?id=1"
```

**Antes de la corrección:**

```
Server: Apache/2.4.65 (Win64) PHP/8.3.28 mod_fcgid/2.3.10-dev
X-Powered-By: PHP/8.3.28
```

**Después de la corrección:**

```
HTTP/1.1 200 OK
Server: Apache
```

Se comprobó que el servidor dejó de revelar versiones específicas y que la aplicación continuó funcionando.

## 5. Consideraciones para AWS

Las mismas directivas deberán aplicarse en la configuración activa de Apache y PHP del servidor EC2 utilizado en AWS Academy.

La corrección fue verificada localmente y deberá validarse nuevamente después del despliegue.