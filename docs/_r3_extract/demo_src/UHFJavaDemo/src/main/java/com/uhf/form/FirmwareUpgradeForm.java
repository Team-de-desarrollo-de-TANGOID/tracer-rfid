/*
 * Created by JFormDesigner on Mon Oct 17 17:20:06 CST 2022
 */

package com.uhf.form;

import com.uhf.UHFMainForm;

import java.awt.*;
import java.awt.event.*;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.Arrays;
import javax.swing.*;
import javax.swing.filechooser.FileFilter;

/**
 * @author zp
 */
public class FirmwareUpgradeForm extends JPanel {
    public FirmwareUpgradeForm() {
        initComponents();
        initUI();
    }
    private void initUI() {
        if(UHFMainForm.isEnglish()){
            btnSelect.setText("Select File");
            btnUHF.setText("Upgrade");
            label2.setText("Type:");
            label1.setText("Path:");

            cmbFileType.removeAllItems();
            cmbFileType.addItem("Mainboard");
            cmbFileType.addItem("UHF");

        }
    }
    private void btnSelectActionPerformed(ActionEvent e) {
        JFileChooser chooser = new JFileChooser(new File("/"));//FileSystemView.getFileSystemView().getDefaultDirectory()
        chooser.setFileFilter(new BinFilter());
        int returnValue = chooser.showOpenDialog(null);
        if (returnValue == JFileChooser.APPROVE_OPTION) {
            File selectedFile = chooser.getSelectedFile();
            textField.setText(selectedFile.getAbsolutePath());
        }
    }

    private void btnUHFActionPerformed(ActionEvent e) {
        pgbar.setValue(0);
        String filePath = textField.getText();
        if (filePath == null || !filePath.endsWith(".bin")) {
            JOptionPane.showMessageDialog(this, UHFMainForm.isEnglish()?"File error, please select uhf firmware!":"文件错误，请选择uhf固件!", "", JOptionPane.ERROR_MESSAGE);
            return;
        }
        btnUHF.setEnabled(false);
        new UHFProgress(pgbar, filePath).start();
    }


    private class BinFilter extends FileFilter {
        public boolean accept(File f) {
            if (f.isDirectory()) {
                return true;
            }
            if (f.isFile()) {
                if (f.getName().endsWith(".bin")) {
                    return true;
                } else {
                    return false;
                }
            }
            return true;
        }

        public String getDescription() {
            return "*.bin";
        }
    }

    private class UHFProgress extends Thread {
        JProgressBar progressBar;
        String mFileName;

        UHFProgress(JProgressBar progressBar, String path) {
            this.progressBar = progressBar;
            this.mFileName = path;
        }

        public void run() {
            try {
                // TODO Auto-generated method stub
                boolean result = false;
                File uFile = new File(mFileName);
                if (!uFile.exists()) {
                    System.out.println("fail");
                    JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                            "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                    btnUHF.setEnabled(true);
                    return;
                }
                long uFileSize = uFile.length();
                System.out.println("uFileSize=" + uFileSize);
                int packageCount = (int) (uFileSize / 64);
                System.out.println("packageCount=" + packageCount);

                RandomAccessFile raf = null;
                try {
                    raf = new RandomAccessFile(mFileName, "r");
                } catch (FileNotFoundException e) {
                }
                if (raf == null) {
                    System.out.println("fail");
                    JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                            "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                    btnUHF.setEnabled(true);
                    return;
                }

                String version = UHFMainForm.uhf.getVersion();//获取版本号
                System.out.println("UHF version=" + version);
                System.out.println("UHF uhfJump2Boot begin");

                if (cmbFileType.getSelectedIndex() == 0) {
                    if (!UHFMainForm.uhf.uhfJump2BootToSTM32()) {
                        System.out.println("uhfJump2BootToSTM32 fail");
                    }
                } else {
                    if (!UHFMainForm.uhf.uhfJump2Boot()) {
                        System.out.println("uhfJump2Boot fail");
                    }
                }
                sleep(2000);
                UHFMainForm.uhf.free();
                sleep(1000);
                UHFMainForm.uhf.init("");

                Thread.sleep(2000);
                System.out.println("UHF uhfStartUpdate begin");
                if (!UHFMainForm.uhf.uhfStartUpdate()) {
                    System.out.println("uhfStartUpdate 失败");
                    JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                            "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                    btnUHF.setEnabled(true);
                    return;
                }
                Thread.sleep(2000);
                int temp = 0;
                int pakeSize = 64;
                byte[] currData = new byte[(int) uFileSize];
                for (int k = 0; k < packageCount; k++) {
                    int index = k * pakeSize;
                    try {
                        int rsize = raf.read(currData, index, pakeSize);
                        // System.out.println( "beginPack=" + index + " endPack=" + (index + pakeSize - 1) + " rsize=" + rsize);
                    } catch (IOException e) {
                        stopUpgrader();
                        System.out.println("失败!");
                        JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                                "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                        return;
                    }
                    System.out.println("send : " + (++temp));
                    if (UHFMainForm.uhf.uhfUpdating(Arrays.copyOfRange(currData, index, index + pakeSize))) {
                        result = true;
                        setprogressValue(index + pakeSize, (int) uFileSize);
                        //sleep(10);
                    } else {
                        System.out.println("uhfUpdating 失败");
                        stopUpgrader();
                        JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                                "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                        btnUHF.setEnabled(true);
                        return;
                    }

                }
                if (uFileSize % pakeSize != 0) {
                    int index = packageCount * pakeSize;
                    int len = (int) (uFileSize % pakeSize);
                    try {
                        int rsize = raf.read(currData, index, len);
                        System.out.println("beginPack=" + index + " countPack=" + len + " rsize=" + rsize);
                    } catch (IOException e) {
                        System.out.println("IOException ");
                        stopUpgrader();
                        JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                                "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                        btnUHF.setEnabled(true);
                        return;
                    }
                    if (UHFMainForm.uhf.uhfUpdating(Arrays.copyOfRange(currData, index, index + len))) {
                        result = true;
                        setprogressValue((int) uFileSize, (int) uFileSize);
                        JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "success",
                                "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                    } else {
                        System.out.println("uhfUpdating 失败");
                        stopUpgrader();
                        JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "fail",
                                "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                        btnUHF.setEnabled(true);
                        return;
                    }
                }
                stopUpgrader();

                // JOptionPane.showConfirmDialog(FirmwareUpgradeForm.this, "success", "", JOptionPane.DEFAULT_OPTION, JOptionPane.INFORMATION_MESSAGE);
                progressBar.setIndeterminate(false);
            } catch (Exception ex) {

            } finally {
                btnUHF.setEnabled(true);
            }
        }

        private void setprogressValue(int value, int total) {
            //设置进度条的值
            progressBar.setValue(value * 100 / total);
        }

        private void stopUpgrader() {
            UHFMainForm.uhf.uhfStopUpdate();
        }
    }


    private void initComponents() {
        // JFormDesigner - Component initialization - DO NOT MODIFY  //GEN-BEGIN:initComponents
        label1 = new JLabel();
        textField = new JTextField();
        btnSelect = new JButton();
        btnUHF = new JButton();
        pgbar = new JProgressBar();
        cmbFileType = new JComboBox<>();
        label2 = new JLabel();

        //======== this ========
        setLayout(null);

        //---- label1 ----
        label1.setText("\u6587\u4ef6\u8def\u5f84\uff1a");
        label1.setFont(label1.getFont().deriveFont(label1.getFont().getSize() + 3f));
        add(label1);
        label1.setBounds(70, 85, 90, label1.getPreferredSize().height);

        //---- textField ----
        textField.setFont(textField.getFont().deriveFont(textField.getFont().getSize() + 3f));
        add(textField);
        textField.setBounds(160, 80, 490, 25);

        //---- btnSelect ----
        btnSelect.setText("\u9009\u62e9\u5347\u7ea7\u6587\u4ef6");
        btnSelect.setFont(btnSelect.getFont().deriveFont(btnSelect.getFont().getSize() + 3f));
        btnSelect.addActionListener(e -> btnSelectActionPerformed(e));
        add(btnSelect);
        btnSelect.setBounds(655, 80, btnSelect.getPreferredSize().width, 25);

        //---- btnUHF ----
        btnUHF.setText("\u5347\u7ea7\u56fa\u4ef6");
        btnUHF.setFont(btnUHF.getFont().deriveFont(btnUHF.getFont().getSize() + 3f));
        btnUHF.addActionListener(e -> btnUHFActionPerformed(e));
        add(btnUHF);
        btnUHF.setBounds(345, 170, 175, btnUHF.getPreferredSize().height);

        //---- pgbar ----
        pgbar.setPreferredSize(new Dimension(146, 10));
        add(pgbar);
        pgbar.setBounds(160, 250, 560, 25);

        //---- cmbFileType ----
        cmbFileType.setModel(new DefaultComboBoxModel<>(new String[] {
            "\u4e3b\u677f\u56fa\u4ef6",
            "UHF\u56fa\u4ef6"
        }));
        add(cmbFileType);
        cmbFileType.setBounds(165, 40, 150, 25);

        //---- label2 ----
        label2.setText("\u6587\u4ef6\u7c7b\u578b\uff1a");
        label2.setFont(label2.getFont().deriveFont(label2.getFont().getSize() + 3f));
        add(label2);
        label2.setBounds(70, 45, 90, label2.getPreferredSize().height);

        {
            // compute preferred size
            Dimension preferredSize = new Dimension();
            for(int i = 0; i < getComponentCount(); i++) {
                Rectangle bounds = getComponent(i).getBounds();
                preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
            }
            Insets insets = getInsets();
            preferredSize.width += insets.right;
            preferredSize.height += insets.bottom;
            setMinimumSize(preferredSize);
            setPreferredSize(preferredSize);
        }
        // JFormDesigner - End of component initialization  //GEN-END:initComponents
    }

    // JFormDesigner - Variables declaration - DO NOT MODIFY  //GEN-BEGIN:variables
    private JLabel label1;
    private JTextField textField;
    private JButton btnSelect;
    private JButton btnUHF;
    private JProgressBar pgbar;
    private JComboBox<String> cmbFileType;
    private JLabel label2;
    // JFormDesigner - End of variables declaration  //GEN-END:variables
}
