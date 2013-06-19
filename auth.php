<?php
include 'config/config.php';
if (!isset($_GET['code'])) {
    header('Location: https://github.com/login/oauth/authorize?client_id=' . $githubApp['client_id'] . '&scope=repo');
    exit;
}

$curl = curl_init();
curl_setopt ($curl, CURLOPT_URL, 'https://github.com/login/oauth/access_token');
curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($curl, CURLOPT_ENCODING, 'UTF-8');
curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($curl, CURLOPT_POSTFIELDS, array_merge($githubApp, ['code' => $_GET['code']]));
$response = curl_exec($curl); 
curl_close($curl);

$token = explode('=', explode('&', $response)[0])[1];
setCookie('token', $token, 0, '/');
header('Location: /');