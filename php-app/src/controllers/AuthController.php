<?php
namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Auth;
use App\Helpers\AuditHelper;
use App\Models\User;
use App\Config\Config;

class AuthController
{
    public static function register(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!isset($data['name'], $data['email'], $data['password'])) {
            Response::json(['message' => 'Dados incompletos'], 400);
            return;
        }
        if (User::findByEmail($data['email'])) {
            Response::json(['message' => 'Email já registado'], 400);
            return;
        }
        $userId = User::create($data);
        $user = User::findById($userId);
        $token = Auth::issueToken($user);
        AuditHelper::log($userId, 'signup', ['email' => $user['email']]);
        Response::json(['token' => $token, 'user' => $user], 201);
    }

    public static function login(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $user = User::findByEmail($data['email'] ?? '');
        if (!$user || !password_verify($data['password'] ?? '', $user['password_hash'])) {
            Response::json(['message' => 'Credenciais inválidas'], 401);
            return;
        }
        $token = Auth::issueToken($user);
        AuditHelper::log($user['id'], 'login', ['email' => $user['email']]);
        Response::json(['token' => $token, 'user' => $user]);
    }

    public static function adminRegister(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $setupToken = Config::get('ADMIN_SETUP_TOKEN');
        if ($setupToken && ($data['setupToken'] ?? '') !== $setupToken) {
            Response::json(['message' => 'Token de configuração inválido'], 401);
            return;
        }
        $data['role'] = 'admin';
        self::register();
    }
}
