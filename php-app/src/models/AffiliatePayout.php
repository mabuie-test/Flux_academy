<?php
namespace App\Models;

use App\Config\Database;

class AffiliatePayout
{
    public static function create(int $userId, float $valor, string $status = 'PENDENTE', string $metodo = 'mpesa', ?string $notes = null): int
    {
        $stmt = Database::pdo()->prepare('INSERT INTO affiliate_payouts (user_id, valor, metodo, status, notes) VALUES (:user_id, :valor, :metodo, :status, :notes)');
        $stmt->execute([':user_id' => $userId, ':valor' => $valor, ':metodo' => $metodo, ':status' => $status, ':notes' => $notes]);
        return (int) Database::pdo()->lastInsertId();
    }

    public static function listForUser(int $userId): array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM affiliate_payouts WHERE user_id = :uid ORDER BY id DESC');
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    public static function listAll(): array
    {
        $sql = 'SELECT p.*, u.email, u.name, u.referral_code FROM affiliate_payouts p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC';
        return Database::pdo()->query($sql)->fetchAll();
    }

    public static function updateStatus(int $payoutId, string $status, int $adminId, ?string $notes = null): void
    {
        $stmt = Database::pdo()->prepare('UPDATE affiliate_payouts SET status = :status, notes = :notes, processed_by = :admin, processed_at = NOW() WHERE id = :id');
        $stmt->execute([':status' => $status, ':notes' => $notes, ':admin' => $adminId, ':id' => $payoutId]);
    }

    public static function find(int $payoutId): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT p.*, u.email, u.name, u.referral_code FROM affiliate_payouts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = :id LIMIT 1');
        $stmt->execute([':id' => $payoutId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
