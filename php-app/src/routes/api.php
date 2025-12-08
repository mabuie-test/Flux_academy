<?php
use App\Controllers\AuthController;
use App\Controllers\OrderController;
use App\Controllers\AdminController;

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

if ($uri === '/api/auth/register' && $method === 'POST') {
    AuthController::register();
    return;
}
if ($uri === '/api/auth/login' && $method === 'POST') {
    AuthController::login();
    return;
}
if ($uri === '/api/auth/admin-register' && $method === 'POST') {
    AuthController::adminRegister();
    return;
}
if ($uri === '/api/orders/quote' && $method === 'POST') {
    OrderController::quote();
    return;
}
if ($uri === '/api/orders' && $method === 'POST') {
    OrderController::create();
    return;
}
if ($uri === '/api/orders' && $method === 'GET') {
    OrderController::index();
    return;
}
if (preg_match('#^/api/orders/(\d+)$#', $uri, $matches) && $method === 'GET') {
    OrderController::show((int) $matches[1]);
    return;
}
if ($uri === '/api/admin/orders' && $method === 'GET') {
    AdminController::listOrders();
    return;
}
if ($uri === '/api/admin/invoices/approve' && $method === 'POST') {
    AdminController::approvePayment();
    return;
}

http_response_code(404);
echo json_encode(['message' => 'Not found']);
