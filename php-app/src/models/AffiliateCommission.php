<?php
namespace App\Models;

use App\Config\Database;

class AffiliateCommission
{
    public static function create(array $data): int
    {
        $stmt = Database::pdo()->prepare('INSERT INTO affiliate_commissions (order_id, referrer_code, beneficiary_email, amount, status) VALUES (:order_id, :referrer_code, :beneficiary_email, :amount, :status)');
        $stmt->execute([
            ':order_id' => $data['order_id'],
            ':referrer_code' => $data['referrer_code'],
            ':beneficiary_email' => $data['beneficiary_email'],
            ':amount' => $data['amount'],
            ':status' => $data['status'] ?? 'PENDENTE',
        ]);
        return (int) Database::pdo()->lastInsertId();
    }

    public static function listForAdmin(): array
    {
        $stmt = Database::pdo()->query('SELECT * FROM affiliate_commissions ORDER BY id DESC');
        return $stmt->fetchAll();
    }
}
