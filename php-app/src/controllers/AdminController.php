<?php
namespace App\Controllers;

use App\Helpers\Auth;
use App\Helpers\Response;
use App\Helpers\AuditHelper;
use App\Helpers\Mailer;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use App\Models\Feedback;
use App\Models\AffiliateCommission;
use App\Config\Config;
use App\Config\Database;

class AdminController
{
    private static function requireAdmin(): array
    {
        $user = Auth::requireUser();
        if ($user['role'] !== 'admin') {
            Response::json(['message' => 'Acesso negado'], 403);
            exit;
        }
        return $user;
    }

    public static function approvePayment(): void
    {
        $admin = self::requireAdmin();
        $invoiceId = (int) ($_POST['invoice_id'] ?? 0);
        $invoice = Invoice::findById($invoiceId);
        if (!$invoice) {
            Response::json(['message' => 'Fatura não encontrada'], 404);
            return;
        }
        Invoice::updateEstado($invoiceId, 'PAGA');
        $order = Order::findWithUser((int) $invoice['order_id']);
        if ($order) {
            Order::updateEstado((int) $order['id'], 'EM_EXECUCAO');
            if (!empty($order['referred_by'])) {
                $commission = round((float) $invoice['valor_total'] * 0.18, 2);
                AffiliateCommission::create([
                    'order_id' => (int) $order['id'],
                    'referrer_code' => $order['referred_by'],
                    'beneficiary_email' => $order['user_email'],
                    'amount' => $commission,
                    'status' => 'PENDENTE',
                ]);
            }
            Mailer::send($order['user_email'], 'Pagamento aprovado', 'Pagamento confirmado para a fatura ' . $invoice['numero'] . '. O seu trabalho segue para execução.');
        }
        AuditHelper::log($admin['id'], 'invoice:approve', ['invoice_id' => $invoiceId]);
        Response::json(['message' => 'Pagamento validado']);
    }

    public static function rejectPayment(): void
    {
        $admin = self::requireAdmin();
        $invoiceId = (int) ($_POST['invoice_id'] ?? 0);
        Invoice::updateEstado($invoiceId, 'PENDENTE');
        if (!empty($_POST['order_id'])) {
            Order::updateEstado((int) $_POST['order_id'], 'PENDENTE_PAGAMENTO');
        }
        AuditHelper::log($admin['id'], 'invoice:reject', ['invoice_id' => $invoiceId]);
        Response::json(['message' => 'Pagamento rejeitado']);
    }

    public static function uploadFinal(): void
    {
        $admin = self::requireAdmin();
        $orderId = (int) ($_POST['order_id'] ?? 0);
        if (!$orderId || empty($_FILES['final']['tmp_name'])) {
            Response::json(['message' => 'Ficheiro final em falta'], 400);
            return;
        }
        $dir = dirname(__DIR__, 2) . '/uploads/finais';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $safeName = uniqid('final_') . '-' . preg_replace('/[^a-zA-Z0-9\.\-_]/', '_', $_FILES['final']['name']);
        $dest = $dir . '/' . $safeName;
        if (!move_uploaded_file($_FILES['final']['tmp_name'], $dest)) {
            Response::json(['message' => 'Não foi possível guardar o ficheiro'], 500);
            return;
        }
        Order::saveFinalFile($orderId, '/uploads/finais/' . $safeName);
        $order = Order::findWithUser($orderId);
        if ($order) {
            Mailer::send($order['user_email'], 'Trabalho entregue', 'O documento final para a encomenda #' . $orderId . ' está disponível para download.');
        }
        AuditHelper::log($admin['id'], 'order:deliver', ['order_id' => $orderId]);
        Response::json(['message' => 'Documento final enviado']);
    }

    public static function listOrders(): void
    {
        self::requireAdmin();
        $orders = Order::listAllWithInvoices();
        Response::json(['orders' => $orders]);
    }

    public static function listUsers(): void
    {
        self::requireAdmin();
        Response::json(['users' => User::listAll()]);
    }

    public static function toggleUser(): void
    {
        $admin = self::requireAdmin();
        $userId = (int) ($_POST['user_id'] ?? 0);
        $active = ($_POST['active'] ?? '1') === '1';
        User::setActive($userId, $active);
        AuditHelper::log($admin['id'], 'user:toggle', ['user_id' => $userId, 'active' => $active]);
        Response::json(['message' => 'Estado atualizado']);
    }

    public static function metrics(): void
    {
        self::requireAdmin();
        $pdo = Database::pdo();
        $totals = [
            'orders' => (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
            'invoices' => (int) $pdo->query('SELECT COUNT(*) FROM invoices')->fetchColumn(),
            'paid' => (float) $pdo->query("SELECT COALESCE(SUM(valor_total),0) FROM invoices WHERE estado='PAGA'")->fetchColumn(),
            'pending' => (float) $pdo->query("SELECT COALESCE(SUM(valor_total),0) FROM invoices WHERE estado!='PAGA'")->fetchColumn(),
        ];
        Response::json(['metrics' => $totals]);
    }

    public static function feedback(): void
    {
        self::requireAdmin();
        Response::json(['feedback' => Feedback::listAll()]);
    }

    public static function commissions(): void
    {
        self::requireAdmin();
        Response::json(['commissions' => AffiliateCommission::listForAdmin()]);
    }
}
