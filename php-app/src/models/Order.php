<?php
namespace App\Models;

use App\Config\Database;

class Order
{
    public static function create(array $data): int
    {
        $stmt = Database::pdo()->prepare('INSERT INTO orders (user_id, tipo, area, nivel, paginas, norma, complexidade, urgencia, descricao, estado, prazo_entrega, referred_by_code, materiais_info, materiais_percentual, invoice_id) VALUES (:user_id, :tipo, :area, :nivel, :paginas, :norma, :complexidade, :urgencia, :descricao, :estado, :prazo_entrega, :referred_by_code, :materiais_info, :materiais_percentual, :invoice_id)');
        $stmt->execute([
            ':user_id' => $data['user_id'],
            ':tipo' => $data['tipo'],
            ':area' => $data['area'],
            ':nivel' => $data['nivel'],
            ':paginas' => $data['paginas'],
            ':norma' => $data['norma'],
            ':complexidade' => $data['complexidade'],
            ':urgencia' => $data['urgencia'],
            ':descricao' => $data['descricao'],
            ':estado' => $data['estado'],
            ':prazo_entrega' => $data['prazo_entrega'],
            ':referred_by_code' => $data['referred_by_code'] ?? null,
            ':materiais_info' => $data['materiais_info'] ?? null,
            ':materiais_percentual' => $data['materiais_percentual'] ?? null,
            ':invoice_id' => $data['invoice_id'] ?? null
        ]);
        return (int) Database::pdo()->lastInsertId();
    }

    public static function attachInvoice(int $orderId, int $invoiceId): void
    {
        $stmt = Database::pdo()->prepare('UPDATE orders SET invoice_id = :invoice_id WHERE id = :id');
        $stmt->execute([':invoice_id' => $invoiceId, ':id' => $orderId]);
    }

    public static function updateEstado(int $orderId, string $estado): void
    {
        $stmt = Database::pdo()->prepare('UPDATE orders SET estado = :estado WHERE id = :id');
        $stmt->execute([':estado' => $estado, ':id' => $orderId]);
    }

    public static function saveFinalFile(int $orderId, string $file): void
    {
        $stmt = Database::pdo()->prepare('UPDATE orders SET final_file = :file, estado = "CONCLUIDA" WHERE id = :id');
        $stmt->execute([':file' => $file, ':id' => $orderId]);
    }

    public static function listForUser(int $userId): array
    {
        $sql = 'SELECT o.*, i.numero as invoice_numero, i.estado as invoice_estado, i.valor_total, i.id as invoice_id FROM orders o LEFT JOIN invoices i ON i.id = o.invoice_id WHERE o.user_id = :uid ORDER BY o.id DESC';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    public static function findWithInvoice(int $orderId): ?array
    {
        $sql = 'SELECT o.*, i.numero as invoice_numero, i.estado as invoice_estado, i.valor_total, i.id as invoice_id, i.vencimento, i.comprovativo FROM orders o LEFT JOIN invoices i ON i.id = o.invoice_id WHERE o.id = :id LIMIT 1';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([':id' => $orderId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function listAllWithInvoices(): array
    {
        $sql = 'SELECT o.*, u.name as user_name, u.email as user_email, u.referral_code, u.referred_by, i.numero as invoice_numero, i.estado as invoice_estado, i.valor_total, i.id as invoice_id, i.comprovativo, i.vencimento FROM orders o LEFT JOIN invoices i ON i.id = o.invoice_id LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC';
        $stmt = Database::pdo()->query($sql);
        return $stmt->fetchAll();
    }

    public static function findWithUser(int $orderId): ?array
    {
        $sql = 'SELECT o.*, u.name as user_name, u.email as user_email, u.referred_by, u.referral_code, i.id as invoice_id, i.numero as invoice_numero, i.estado as invoice_estado, i.valor_total FROM orders o LEFT JOIN users u ON u.id = o.user_id LEFT JOIN invoices i ON i.id = o.invoice_id WHERE o.id = :id LIMIT 1';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([':id' => $orderId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
