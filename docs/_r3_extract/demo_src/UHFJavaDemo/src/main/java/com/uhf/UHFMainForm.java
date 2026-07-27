/*
 * Created by JFormDesigner on Mon Oct 17 16:34:19 CST 2022
 */

package com.uhf;

import java.awt.event.*;
import javax.swing.event.*;
import javax.swing.plaf.*;


import com.rscja.deviceapi.ConnectionState;
import com.rscja.deviceapi.RFIDWithUHFUsb;
import com.rscja.deviceapi.interfaces.ConnectionStateCallback;
import com.rscja.deviceapi.interfaces.KeyEventCallback;
import com.rscja.utility.StringUtility;
import com.uhf.form.*;

import java.awt.*;
import java.io.File;
import java.util.ArrayList;
import java.util.Locale;
import javax.swing.*;
import javax.swing.border.*;

/**
 * @author zp
 */
public class UHFMainForm extends JFrame {

    static {
        if (!System.getProperty("os.name").toLowerCase().contains("win")) {
            File file = new File("");
            File sopath = new File(file.getAbsolutePath(), "libTagReader.so");
            System.out.println("sopath=" + sopath.getAbsolutePath());
            System.load(sopath.getAbsolutePath());
            //  System.loadLibrary("rxtxSerial");
        }
    }

    public static void main(String[] args) {
        UHFMainForm frame = new UHFMainForm();
        frame.setVisible(true);
    }

    public static RFIDWithUHFUsb uhf = RFIDWithUHFUsb.getInstance();;


    ArrayList<JPanel> formList = new ArrayList<JPanel>();
    InventoryForm inventoryForm = new InventoryForm();
    ReadWriteForm readWriteForm = new ReadWriteForm();
    ConfigForm configForm = new ConfigForm();
    LockKillForm lockKillForm = new LockKillForm();
    UHFInfoForm uhfInfoForm = new UHFInfoForm();
    TemperatureForm temperatureForm = new TemperatureForm();
    FirmwareUpgradeForm upgradeForm = new FirmwareUpgradeForm();

    public UHFMainForm() {
        initComponents();
        initUI();
    }

    private void initUI() {

        if(isEnglish()){
            label1.setText("Mode:");
            btnConnect.setText("Connect");
        }
        tabPane.addTab(isEnglish()?"Inventory":"盘点", null, inventoryForm, null);
        tabPane.addTab(isEnglish()?"Read&Write":"读写", null, readWriteForm, null);
        tabPane.addTab(isEnglish()?"Config":"配置", null, configForm, null);
        tabPane.addTab(isEnglish()?"Lock-Kill":"锁-销毁", null, lockKillForm, null);
        tabPane.addTab(isEnglish()?"Info":"设备信息", null, uhfInfoForm, null);
        tabPane.addTab(isEnglish()?"temperature":"温度", null, temperatureForm, null);
        tabPane.addTab(isEnglish()?"Upgrade":"升级", null, upgradeForm, null);

        tabPane.setTitleAt(0, isEnglish()?"Inventory":"盘点");
        tabPane.setTitleAt(1, isEnglish()?"Read&Write":"读写");
        tabPane.setTitleAt(2, isEnglish()?"Config":"配置");
        tabPane.setTitleAt(3, isEnglish()?"Lock-Kill":"锁-销毁");
        tabPane.setTitleAt(4, isEnglish()?"Info":"设备信息");
        tabPane.setTitleAt(5, isEnglish()?"temperature":"温度");
        tabPane.setTitleAt(6, isEnglish()?"Upgrade":"升级");

        formList.add(inventoryForm);
        formList.add(readWriteForm);
        formList.add(configForm);
        formList.add(lockKillForm);
        formList.add(uhfInfoForm);
        formList.add(temperatureForm);
        formList.add(upgradeForm);

    }

    /**
     * 选选项卡的选择项发送改变
     *
     * @param e
     */
    private void tabPaneStateChanged(ChangeEvent e) {
        int index = tabPane.getSelectedIndex();
        for (int i = 0; i < formList.size(); i++) {
            if (i == index) {
                formList.get(i).setVisible(true);
            } else {
                formList.get(i).setVisible(false);
            }
        }
    }

    //连接网络或者串口
    private void btnConnectActionPerformed(ActionEvent e) {
        if (btnConnect.getText().equals(isEnglish()?"Connect":"连接")) {
 

            boolean result =uhf.init("");
            if (!result) {
                JOptionPane.showMessageDialog(getContentPane(), isEnglish()?"Connect Fail !":"连接失败!", "", JOptionPane.ERROR_MESSAGE);
                return;
            }
            uhf.setConnectionStateCallback(new ConnectionStateCallback() {
                @Override
                public void getState(ConnectionState connectionState, Object o) {
                    System.out.println("connectionState= "+connectionState);
                    if(connectionState == ConnectionState.DISCONNECTED){
                        if (inventoryForm.isVisible()) {
                             inventoryForm.stopInventory();
                        }
                        uhf.free();
                        btnConnect.setText(isEnglish()?"Connect":"连接");
                        cmbCommunicationMode.setEnabled(true);
                    }

                }
            });
            //连接成功
            btnConnect.setText(isEnglish()?"Disconnect":"断开");
            cmbCommunicationMode.setEnabled(false);
            uhf.setKeyEventCallback(new KeyEventCallback() {
                @Override
                public void onKeyDown(int keyCode) {
                   byte[] data= uhf.startScanBarcode();
                   if(data!=null)
                   System.out.println("data="+ StringUtility.bytes2HexString(data,data.length));
                   else
                   System.out.println("data= null");
                }

                @Override
                public void onKeyUp(int keyCode) {

                }
            });
        } else {
            if (inventoryForm.isVisible()) {
                inventoryForm.stopInventory();
            }
            uhf.setConnectionStateCallback(null);
            uhf.free();
            btnConnect.setText(isEnglish()?"Connect":"连接");
            cmbCommunicationMode.setEnabled(true);
        }
    }


    private void cmbCommunicationModeActionPerformed(ActionEvent e) {
//        if(cmbCommunicationMode.getSelectedIndex()==0){
//            System.out.println("serial port");
//            panelSerialPort.setVisible(true);
//            panelNetWork.setVisible(false);
//            if(uhf==null){
//                uhf=new RFIDWithUHFSerialPortUR4();
//            }
//            ur4=ur4SerialPort;
//
//        }else if(cmbCommunicationMode.getSelectedIndex()==1){
//            System.out.println("network");
//            panelSerialPort.setVisible(false);
//            panelNetWork.setVisible(true);
//            if(ur4Network==null){
//                ur4Network=new RFIDWithUHFNetworkUR4();
//            }
//            ur4=ur4Network;
//        }
    }
    public static boolean isEnglish() {

        Locale l = Locale.getDefault();
        if (l != null) {
            String strLan = l.getLanguage();
            if ("zh".equals(strLan)) {
                return false;
            }
        }
        return true ;

    }
    private void initComponents() {
        // JFormDesigner - Component initialization - DO NOT MODIFY  //GEN-BEGIN:initComponents
        dialogPane = new JPanel();
        contentPanel = new JPanel();
        panel3 = new JPanel();
        panel1 = new JPanel();
        tabPane = new JTabbedPane();
        panel5 = new JPanel();
        panel6 = new JPanel();
        cmbCommunicationMode = new JComboBox<>();
        label1 = new JLabel();
        btnConnect = new JButton();

        //======== this ========
        setTitle("USB(v2.0)");
        Container contentPane = getContentPane();
        contentPane.setLayout(new BorderLayout());

        //======== dialogPane ========
        {
            dialogPane.setBorder(new EmptyBorder(12, 12, 12, 12));
            dialogPane.setLayout(new BorderLayout());

            //======== contentPanel ========
            {
                contentPanel.setBackground(new Color(238, 238, 238));
                contentPanel.setLayout(null);

                //======== panel3 ========
                {
                    panel3.setLayout(null);

                    {
                        // compute preferred size
                        Dimension preferredSize = new Dimension();
                        for(int i = 0; i < panel3.getComponentCount(); i++) {
                            Rectangle bounds = panel3.getComponent(i).getBounds();
                            preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                            preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                        }
                        Insets insets = panel3.getInsets();
                        preferredSize.width += insets.right;
                        preferredSize.height += insets.bottom;
                        panel3.setMinimumSize(preferredSize);
                        panel3.setPreferredSize(preferredSize);
                    }
                }
                contentPanel.add(panel3);
                panel3.setBounds(10, 240, panel3.getPreferredSize().width, 285);

                //======== panel1 ========
                {
                    panel1.setLayout(null);

                    {
                        // compute preferred size
                        Dimension preferredSize = new Dimension();
                        for(int i = 0; i < panel1.getComponentCount(); i++) {
                            Rectangle bounds = panel1.getComponent(i).getBounds();
                            preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                            preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                        }
                        Insets insets = panel1.getInsets();
                        preferredSize.width += insets.right;
                        preferredSize.height += insets.bottom;
                        panel1.setMinimumSize(preferredSize);
                        panel1.setPreferredSize(preferredSize);
                    }
                }
                contentPanel.add(panel1);
                panel1.setBounds(new Rectangle(new Point(300, 40), panel1.getPreferredSize()));

                //======== tabPane ========
                {
                    tabPane.setTabLayoutPolicy(JTabbedPane.SCROLL_TAB_LAYOUT);
                    tabPane.addChangeListener(e -> tabPaneStateChanged(e));
                }
                contentPanel.add(tabPane);
                tabPane.setBounds(5, 80, 1105, 655);

                //======== panel5 ========
                {
                    panel5.setLayout(null);

                    {
                        // compute preferred size
                        Dimension preferredSize = new Dimension();
                        for(int i = 0; i < panel5.getComponentCount(); i++) {
                            Rectangle bounds = panel5.getComponent(i).getBounds();
                            preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                            preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                        }
                        Insets insets = panel5.getInsets();
                        preferredSize.width += insets.right;
                        preferredSize.height += insets.bottom;
                        panel5.setMinimumSize(preferredSize);
                        panel5.setPreferredSize(preferredSize);
                    }
                }
                contentPanel.add(panel5);
                panel5.setBounds(new Rectangle(new Point(25, 90), panel5.getPreferredSize()));

                //======== panel6 ========
                {
                    panel6.setBackground(new Color(138, 154, 249));
                    panel6.setLayout(null);

                    //---- cmbCommunicationMode ----
                    cmbCommunicationMode.setModel(new DefaultComboBoxModel<>(new String[] {
                        "USB"
                    }));
                    cmbCommunicationMode.addActionListener(e -> cmbCommunicationModeActionPerformed(e));
                    panel6.add(cmbCommunicationMode);
                    cmbCommunicationMode.setBounds(80, 20, 155, cmbCommunicationMode.getPreferredSize().height);

                    //---- label1 ----
                    label1.setText("\u901a\u8baf\u65b9\u5f0f:");
                    panel6.add(label1);
                    label1.setBounds(new Rectangle(new Point(20, 25), label1.getPreferredSize()));

                    //---- btnConnect ----
                    btnConnect.setText("\u8fde\u63a5");
                    btnConnect.setBackground(new Color(238, 238, 238));
                    btnConnect.addActionListener(e -> btnConnectActionPerformed(e));
                    panel6.add(btnConnect);
                    btnConnect.setBounds(820, 15, 115, 40);

                    {
                        // compute preferred size
                        Dimension preferredSize = new Dimension();
                        for(int i = 0; i < panel6.getComponentCount(); i++) {
                            Rectangle bounds = panel6.getComponent(i).getBounds();
                            preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                            preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                        }
                        Insets insets = panel6.getInsets();
                        preferredSize.width += insets.right;
                        preferredSize.height += insets.bottom;
                        panel6.setMinimumSize(preferredSize);
                        panel6.setPreferredSize(preferredSize);
                    }
                }
                contentPanel.add(panel6);
                panel6.setBounds(-10, -5, 1115, 80);

                {
                    // compute preferred size
                    Dimension preferredSize = new Dimension();
                    for(int i = 0; i < contentPanel.getComponentCount(); i++) {
                        Rectangle bounds = contentPanel.getComponent(i).getBounds();
                        preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                        preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
                    }
                    Insets insets = contentPanel.getInsets();
                    preferredSize.width += insets.right;
                    preferredSize.height += insets.bottom;
                    contentPanel.setMinimumSize(preferredSize);
                    contentPanel.setPreferredSize(preferredSize);
                }
            }
            dialogPane.add(contentPanel, BorderLayout.NORTH);
        }
        contentPane.add(dialogPane, BorderLayout.CENTER);
        pack();
        setLocationRelativeTo(getOwner());
        // JFormDesigner - End of component initialization  //GEN-END:initComponents
    }

    // JFormDesigner - Variables declaration - DO NOT MODIFY  //GEN-BEGIN:variables
    private JPanel dialogPane;
    private JPanel contentPanel;
    private JPanel panel3;
    private JPanel panel1;
    private JTabbedPane tabPane;
    private JPanel panel5;
    private JPanel panel6;
    private JComboBox<String> cmbCommunicationMode;
    private JLabel label1;
    private JButton btnConnect;
    // JFormDesigner - End of variables declaration  //GEN-END:variables


}
