<?php
namespace App\Controllers;

use App\Helpers\Auth;
use App\Helpers\Response;
use App\Helpers\AuditHelper;
use App\Helpers\Mailer;
use App\Models\Invoice;
use App\Models\Order;

class AdminController
{
    public static function approvePayment(): void
    {
        $user = Auth::requireUser();
        if ($user['role'] !== 'admin') {
            Response::json(['message' => 'Acesso negado'], 403);
            return;
        }
        $invoiceId = (int) ($_POST['invoice_id'] ?? 0);
        Invoice::updateEstado($invoiceId, 'PAGA');
        AuditHelper::log($user['id'], 'invoice:approve', ['invoice_id' => $invoiceId]);
        if (!empty($_POST['email_cliente']) && !empty($_POST['numero'])) {
            Mailer::send($_POST['email_cliente'], 'Pagamento aprovado', 'Pagamento confirmado para a fatura ' . $_POST['numero']);
        }
        Response::json(['message' => 'Pagamento validado']);
    }

    public static function listOrders(): void
    {
        $user = Auth::requireUser();
        if ($user['role'] !== 'admin') {
            Response::json(['message' => 'Acesso negado'], 403);
            return;
        }
        $orders = Order::listAllWithInvoices();
        Response::json(['orders' => $orders]);
    }
}
