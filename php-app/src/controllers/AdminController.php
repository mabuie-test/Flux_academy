<?php
namespace App\Controllers;

use App\Helpers\Auth;
use App\Helpers\Response;
use App\Helpers\AuditHelper;
use App\Helpers\Mailer;
use App\Models\Invoice;

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
        Mailer::send($_POST['email_cliente'], 'Pagamento aprovado', 'Pagamento confirmado para a fatura ' . $_POST['numero']);
        Response::json(['message' => 'Pagamento validado']);
    }
}
