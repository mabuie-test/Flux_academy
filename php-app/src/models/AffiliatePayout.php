<?php
namespace App\Models;

use App\Config\Database;

class AffiliatePayout
{
    public static function create(int $userId, float $valor, string $status = 'PENDENTE'): int
    {
        $stmt = Database::pdo()->prepare('INSERT INTO affiliate_payouts (user_id, valor, status) VALUES (:user_id, :valor, :status)');
        $stmt->execute([':user_id' => $userId, ':valor' => $valor, ':status' => $status]);
        return (int) Database::pdo()->lastInsertId();
    }
}
